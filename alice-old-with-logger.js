var esprima = require('esprima');
var escodegen = require('escodegen');

var currentDirectory = __dirname;

var debugging = false;

function requireHook() {
  var oldHook = require.extensions['.js'];
  require.extensions['.js'] = function (mod, filename) {
    var oldCompile = mod._compile;
    mod._compile = function (code, filename) {
      if (!filename.match(/node_modules/) && !filename.match(/singleton/)) {
        var transformedCode = transform(code, filename);

        if (debugging) {
            console.log(transformedCode); // VERY USEFUL
        }
      } else {
        var transformedCode = code;
      }
      oldCompile.call(mod, transformedCode, filename);
    }
    oldHook(mod, filename);
  }
}
requireHook();

var writeFile = function(jsonBlob) {
  var fs = require('fs');
  // console.log('WRITE FILE', jsonBlob);

  var body = '';

  for (var key in jsonBlob) {
      body+= '<div>';
      body+= '<p>Filename: ' + key + '</p>';
      jsonBlob[key].forEach(function(value, key) {
        body+= '<p>Contents: ' + value + '</p>';
      });

      body+= '</div>';
  };

  fs.writeFileSync(currentDirectory + '/analysis.html', buildHtml(body));


  function buildHtml(body) {
    var header = 'Some Header';

    return '<!DOCTYPE html>'
         + '<html><header>' + header + '</header><body>' + body + '</body></html>';
  };
}

function printThis(filename, ranInner) {
    if (debugging) {
        return esprima.parse('console.log(\'the middle\' , "' + filename + '" , ' + JSON.stringify(ranInner.toString()) + ' )');
    } else {
        var pushToStore ='singleton.add("'+ filename+ '", '+ JSON.stringify(ranInner.toString()) +');';

        return esprima.parse(pushToStore);
    }
}

function transform(srcCode, filename) {
  var parsed = esprima.parse(srcCode, {
  	loc: true, // Nodes have line and column-based location info
    range: true // Nodes have an index-based location range (array)
  });
  // console.log(parsed);
  var newParsed = Object.assign({}, parsed);

  newParsed.body = [];
  if (debugging) {
    newParsed.body.push(esprima.parse(''));
  } else {
    //SIGINT
    newParsed.body.push(esprima.parse('var writeFile=' + writeFile + '; var currentDirectory="' + currentDirectory + '"; var singleton = require(currentDirectory + \'/singleton\'); process.on(\'exit\', function() { writeFile(singleton.getAll()); process.exit(); }); '));
  }

  parsed.body.forEach(function(value, key) {
      var ranOne = escodegen.generate(value);

      var hasNested = false;

      // only print this if none of others have anything. I THINK
      if (debugging) {
  		    newParsed.body.push(esprima.parse('console.log(\'the MAIN middle\' , "' + filename + '" , ' + JSON.stringify(ranOne.toString()) + ' )'));
      } else {
          newParsed.body.push(esprima.parse(''));
      }
      newParsed.body.push(value);

      var run = (newParsed.body.length-1)/2; // -1 as added globalStore
      var currentBody = newParsed.body[key+run+1]; // +1 as added globaStore


      // declarative function:
      // function tree() {
      // }
      if (value.type === 'FunctionDeclaration' &&
        value.body && value.body.body.length > 0) {
        hasNested = true;

        // all of the function
        // currentBody.body.body.unshift(printThis(filename, ranOne));

        var outerKey = 0;
        value.body.body.forEach(function(declValue, declKey) {
            outerKey = declKey * 2; // real key following items added by splice.
            // MAYBE dont run unless code catches it..
            var body = currentBody.body.body;
            var realValue = body[outerKey];

            if (body[outerKey].type === 'VariableDeclaration') {
                var ranInner = escodegen.generate(realValue);
                body.splice(
                  outerKey,
                  0,
                  printThis(filename, ranInner)
                );
            }


            if (body[outerKey].type === 'IfStatement') {

                var ranInner = escodegen.generate(realValue.test);
                body.splice(
                  outerKey,
                  0,
                  printThis(filename, ranInner)
                )
                // NOTE: FOR MORE items need to consequent.body.forEach it
                var ranInner = escodegen.generate(realValue.consequent.body[0]);
                realValue.consequent.body.splice(
                  0,// only for FIRST item inside IF
                  0,
                  printThis(filename, ranInner)
                )

                if (realValue.alternate) { // might not be an else
                    var ranInner = escodegen.generate(realValue.alternate.body[0]);
                    realValue.consequent.body.splice(
                      0,
                      0,
                      printThis(filename, ranInner)
                    )
                }
            }

            if (body[outerKey].type === 'ReturnStatement') {
                var ranInner = escodegen.generate(realValue);
                body.splice(
                  outerKey,
                  0,
                  printThis(filename, ranInner)
                );
            }
        });
      }

      // for function arguments (e.g. callbacks) e.g:
      // get('/', function (req, res) {
      //     res.send('hello world');
      // });
      if (value.type === 'ExpressionStatement' &&
        value.expression && value.expression.arguments) {
        value.expression.arguments.forEach(function(argValue, argKey) {
          if(argValue.body) {
            // console.log('INSIDE');
            hasNested = true;
            var ranInner = escodegen.generate(argValue.body.body[0]);
            // console.log('ran one: ' , ranOne);
            currentBody.expression.arguments[argKey].body.body.unshift(printThis(filename, ranInner));
            // console.log(escodegen.generate(currentBody.expression.arguments[argKey].body.body[0]));
          }
        });
      }

      // variable declaration (includes expression)
      // var callback = function (req, res) {
      //     res.send('hello world');
      // };
      if (value.type === 'VariableDeclaration' &&
        value.declarations &&
        value.declarations[0] &&
        value.declarations[0].init &&
        value.declarations[0].init.body &&
        value.declarations[0].init.body.body) {

        hasNested = true;
        currentBody.declarations[0].init.body.body.unshift(printThis(filename, ranOne));

        // nested
        // call function (ExpressionStatement -> CallExpression)
      }

      // CJS Export:
      // module.exports = function(){
      // }
      if(value.type === 'ExpressionStatement' &&
          value.expression && value.expression.right && value.expression.right.body) {

          hasNested = true;

          if (currentBody.expression.right.body.body.length > 0) {
              currentBody.expression.right.body.body.forEach(function(exportValue, exportKey) {
                  // Nested
                  // VariableDeclaration

                  // Returns
                  if (currentBody.expression.right.body.body[exportKey] &&
                    currentBody.expression.right.body.body[exportKey].type === 'ReturnStatement') {
                      var body = currentBody.expression.right.body.body;
                      var newReturnBody = body[exportKey];
                      var ranInner = escodegen.generate(newReturnBody);
                      body.splice(
                        exportKey, // position of return pushing return up
                        0,
                        printThis(filename, ranInner)
                      );
                  }

                  // IF
                  if (currentBody.expression.right.body.body[exportKey] &&
                    currentBody.expression.right.body.body[exportKey].type === 'IfStatement') {

                      // for condition:
                      // var body = currentBody.expression.right.body.body;
                      // var newConditionBody = body[exportKey];
                      // var ranInner = escodegen.generate(newConditionBody);
                      // body.splice(
                      //   exportKey, // position of condition
                      //   0,
                      //   printThis(filename, ranInner)
                      // );

                      var newConsequentBody = currentBody.expression.right.body.body[exportKey].consequent.body;
                      var ranInner = escodegen.generate(newConsequentBody[0]);
                      newConsequentBody.unshift(printThis(filename, ranInner));
                      var newAlternateBody = currentBody.expression.right.body.body[exportKey].alternate.body;
                      var ranInner = escodegen.generate(newAlternateBody[0]);
                      newAlternateBody.unshift(printThis(filename, ranInner));
                  }

              });

          } else {
            currentBody.expression.right.body.body.unshift(printThis(filename, ranOne));
          }
      }

      // IF block (follow the branch)
      if (value.type === 'IfStatement') {
          // condition
          // var ranOne = escodegen.generate(value.test);
          // newParsed.body.splice(
          //   key+run, // put before item
          //   0,
          //   printThis(filename, ranOne)
          // )

          var ranInner = escodegen.generate(currentBody.consequent.body[0]);
          currentBody.consequent.body.unshift(printThis(filename, ranInner));

          if (currentBody.alternate) { // might not be an else
              var ranInner = escodegen.generate(currentBody.alternate.body[0]);
              currentBody.alternate.body.unshift(printThis(filename, ranInner));
          }
      }

      // If nothing granular, print
      // messes up run number though as expects it there.
      // if (!hasNested) {
          // newParsed.body.push(esprima.parse('console.log(\'the middle\' , "' + filename + '" , ' + JSON.stringify(ranOne.toString()) + ' )'));
      // }
  });

  var newlyGeneratedCode = escodegen.generate(newParsed);

  return newlyGeneratedCode;
}

var file = process.argv[2]
require(file);
