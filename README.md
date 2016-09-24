
run: node lib/index.js

== what?
PRODUCT:
- run a request, creates html page with diagram of files + code within that file.
- visual representation of request.
- easier to follow/read.

like dynamic program slicing.
- input and told exactly what runs.

runtime dependency tree?
stack traces/call stack?
- dont think it is as will give details of whats called that line...the chain of dependencies, not the app.
static analysis?

===

== Notes:
- iterate over original value, not new...as writing to new and messes up forEach.
- what splice need keys to follow (real location after instrumenting): 0==0, 1==2, 2==4
==

== TODO:
- write to global and shutdown handler writes to file.
-- http://stackoverflow.com/questions/8510008/express-js-shutdown-hook

- make cli tool - DONE...node analyse.js my-entry-file.js
-- could improve into 'analyse my-entry-file.js' creating node-cli package.

- allow ES6 (espirma works for ES6) - DONE
-- work with es6 espress?
-- might need some updates for exports/imports etc but should work
--

--- low priority..i know its possible
- fix
-- modules (import not needed, just code inside export)
-- function calls. e.g. guy()
-- nested: all
-- functions e.g. with assigns or if's need to not be added in 1 blob, need individual items

- allow recursive checks of ALL types...For nested.
i.e. can hand object prop into function checking for IF, EXPORT, etc...

- Dont print if is nested
--
==


== developing off parsed AST
code into http://esprima.org/demo/parse.html
- put statement in so can see where it should be appended dynamically.
paste AST object and play with appending on babeljs.io/repl/

SHOULD be checking for 'type' first.
==



== Process:
at runtime (for a request):
via a hook. build AST. parse into html file.
#craig-node file.js
#open my-route.html -> think istanbul can help with that..

if istanbul can build+parse when runs a test, why cant do it for a request/supertest?
require-hooks can help, BUT they only run when modules imported, at build-time..
SO:
how do unit tests do it? does each unit test run completely fresh?
each unit test much run everything??
==

== Istanbul notes
"Module loader hooks to instrument code on the fly."

- takes js program and passes it through Esprima to get the syntax tree.
- Then injects some instrumentation by wrapping various syntax constructs
- After that, a new js program is generated from the syntax tree by using Escodegen.
- when the program runs, the injected annotation is also executed accordingly and thereby the statistics of the program execution can be gathered.

https://ariya.io/2012/12/javascript-code-coverage-with-istanbul
===

== Istanbul internals
Esprima for AST (parser)
http://esprima.org/doc/index.html
http://sevinf.github.io/blog/2012/09/29/esprima-tutorial/
http://tobyho.com/2013/12/02/fun-with-esprima/
- token (lexical analysis, the tokens)
- parse (syntactic analysis, parses tokens into X)

Escodegen can parse AST (code generator):
- js -> AST -> js

Escope https://github.com/estools/escope can parse AST (code generator):
- can it do it at runtime? only build-time. ????
===

== Istanbul hook
http://gotwarlost.github.io/istanbul/public/apidocs/classes/Hook.html
- hookRequire "hooks `require` to return transformed code to the node module loader."
-- same as require hook, doesnt work at runtime tho.
-- https://github.com/gotwarlost/istanbul/blob/master/lib/hook.js
===


== Require hook:
// grab old .js ext function
var oldHook = require.extensions['.js'];
// set new .js ext function to X
require.extensions['.js'] = function (mod, filename) {
  var oldCompile = mod._compile;
  // cache the actual compile implementation

  mod._compile = function (code, filename) {
    // re-compile code based on something here.
    // ..
    oldCompile.call(mod, code, filename);
    // compile again
  }
  // now run old function
  oldHook(mod, filename);
}
===




== plugin linking
npm link                    
# creates global link

npm link babel-plugin-craig-test              
# link-install the package
==

== plugin, locally in .babelrc
,"plugins": ["./plugin/index.js"]
===

=== Babel CLI:
#babel index.js --out-file app.js
===

== Node Simple Profile:
https://nodejs.org/en/docs/guides/simple-profiling/
#NODE_ENV=production node --prof index.js   
#node --prof-process isolate-0x102004a00-v8.log > log.txt
- does print files but its also compiled so cant follow.
- what about if in ES5?
===

== Babel's Babylon:
https://github.com/babel/babylon
==

== native Error Stack:
var stack = new Error().stack
console.log( stack )
- not helpful, its the current location and what called it..
==

http://www.chromium.org/developers/how-tos/trace-event-profiling-tool