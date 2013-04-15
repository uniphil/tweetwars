document.write('<pre>'); var printline = function(t) { document.write(t); document.write('\n'); };


//////////////////// LEXER ////////////////////

var State = function(token_name) {
    this.token_name = token_name;
    this.transitions = new Array();
    this.add_transition = function(transition) {
        this.transitions.push(transition);
    };
    this.get_next = function(character) {
        for (var t = 0; t < this.transitions.length; t++) {
            if (this.transitions[t].condition.test(character))
                return this.transitions[t].next_state;
        }
        // if we make it to the end, there is no next.
        return null;
    }
    return this;
};
var Transition = function(condition, next_state) {
    this.condition = condition;
    this.next_state = next_state;
    return this;
};

var start = new State('invalid exit');
var integer = new State('literal');
var num_dot = new State('invalid exit');
var floating = new State('literal');
var short_name = new State('name');
var long_name = new State('name');
var o_paren = new State('o_paren');
var c_paren = new State('c_paren');
var operator = new State('operator');

// whitespace
start.add_transition(new Transition(/\s/, start));
// numbers
start.add_transition(new Transition(/\d/, integer));
integer.add_transition(new Transition(/\d/, integer));
integer.add_transition(new Transition(/\./, floating));
start.add_transition(new Transition(/\./, num_dot));
num_dot.add_transition(new Transition(/\d/, floating));
floating.add_transition(new Transition(/\d/, floating));
// names
start.add_transition(new Transition(/[co]/, short_name));
short_name.add_transition(new Transition(/[\-\|]/, long_name));
// parens
start.add_transition(new Transition(/\(/, o_paren));
start.add_transition(new Transition(/\)/, c_paren));
// operators
start.add_transition(new Transition(/[\^\*\/\+\-<>]/, operator));


var feed_the_machine = function(expression) {
    // returns a list of tokens for an expression, or raises tokenize error.
    var char_index = 0,
        tokenized = new Array();
    while (char_index < expression.length) {
        state = start;
        token_start = char_index;
        while (true) {
            character = expression.slice(char_index, char_index + 1);
            next_state = state.get_next(character);
            if (next_state === null) {
                if (state.token_name === 'invalid exit')
                    throw 'tokenize error at ' + char_index;
                tokenized.push([
                    state.token_name,
                    expression.slice(token_start, char_index),
                    [token_start, char_index],
                ]);
                break;
            } else {
                char_index++;
                if (next_state.token_name === 'invalid exit')
                    token_start = char_index;
                state = next_state;
            }
        }
    }
    return tokenized;
};



//////////////////// PARSER //////////////////////

var op_order = [  // highest to lowest
    /\^/,
    /[\*\/]/,
    /[\+\-]/,
    /[<>]/,
];
var op_fns = d3.map({
    "^": function(l, r) { return function(cx) { return l(cx) ^ r(cx); }; },
    "*": function(l, r) { return function(cx) { return l(cx) * r(cx); }; },
    "/": function(l, r) { return function(cx) { return l(cx) / r(cx); }; },
    "+": function(l, r) { return function(cx) { return l(cx) + r(cx); }; },
    "-": function(l, r) { return function(cx) { return l(cx) - r(cx); }; },
    "<": function(l, r) { return function(cx) { return l(cx) < r(cx); }; },
    ">": function(l, r) { return function(cx) { return l(cx) > r(cx); }; },
});

var compile_strategy = function(strategy) {
    // in-line replace tokens with a tree of callables
    tokens = feed_the_machine(strategy);
    // start with literals and names
    for (var t = 0; t < tokens.length; t++) {
        if (tokens[t][0] === "literal") {
            value = parseFloat(tokens[t][1]);
            tokens[t] = function(context) { return value; };
        } else if (tokens[t][0] === "name") {
            name = tokens[t][1]
            tokens[t] = function(context) { return context.get(name); };
        }
    }
    // parens
    // operators
    var exiter = 0;
    for (var o = 0; o < op_order.length; o++) {
        console.log('checking for o ' + op_order[o])
        for (var t = 0; t < tokens.length;) {
            console.log('against token ' + tokens[t][1]);
            if (exiter++ > 100) throw "exit!";
            if ((tokens[t] instanceof Array) && tokens[t][0] === "operator") {
                console.log('found operator!');
                if (op_order[o].test(tokens[t][1])) {
                    console.log(tokens);
                    console.log('WOOOO matched operator!');
                    group_index = t-1; // assuming three tokens for binary op
                    group = tokens.splice(t-1, t+1);
                    console.log('token, again, ' + group[1][1]);
                    callable = op_fns.get(group[1][1])(group[0], group[2]); // l, r
                    tokens.splice(t-1, 0, callable);
                    console.log(tokens);
                } else {
                    console.log('operator no match for me');
                    t++;
                }
            } else {
                console.log('not an operator, moving on...');
                t++;
            }
        }
    }
    return tokens;
}


c_in_strategy = "2 + .1 * 3.2"; // propel toward center
var strat = compile_strategy(c_in_strategy)
printline(strat.join('\n'));
console.log(strat);
// printline(compile_strategy(c_in_strategy()));

// FAILING CASES: '.' is evaluated as a literal


// var unary_funcs = d3.map({
//     "-": function(n) { return -n; },  // negate
// });

// var binary_funcs = d3.map({
//     "-": function(l, r) { return l - r; },
//     "+": function(l, r) { return l + r; },
//     "*": function(l, r) { return l * r; },
//     "/": function(l, r) { return l / r; },
//     "^": function(l, r) { return Math.pow(l, r); },
//     "<": function(l, r) { return int(l < r); },
//     ">": function(l, r) { return int(l > r); },
// });

// var printline = function(t) { document.write(t); document.write('\n'); };


// printline('literal -> 1: ' + Literal('1')());
// printline('literal -> 2: ' + (Literal('1')() + Literal('1')()));

// printline('name    -> 1: ' + Name('o')(d3.map({'o': 1})));

// var Unary = function(rep) {
//     return function(thing) { return unary_funcs.get(rep)(thing); };
// };
// printline('unary  -> -1: ' + Unary('-')(Literal('1')()));

// var Binary = function(rep) {
//     return function(things) {
//         return binary_funcs.get(rep)(things[0], things[1])
//     };
// };
// printline('binary  -> 2: ' + Binary('+')([Literal('1')(), Literal('1')()]));

// var Func = function(rep, conf) {
//     // functions are unary
//     return function(thing) {
//         console.log('execing');
//         console.log('fn: ' + config_funcs.get(rep));
//         console.log('')
//         return config_funcs.get(rep)(conf, thing);
//     };
// };
// printline('func    -> 1: ' + Func('/', Literal('2'))(Literal('0.5')()));
// printline('func   -> .5: ' + Func('j', Literal('0.5'))(Literal('.5')()));

// var Feeder = function(express) {
//     // get a char at a time
//     this.express = express;
//     this.pos = 0;
//     this.next_char = function() {
//         if (this.pos === this.express.length) {
//             return null;
//         }
//         var ch = this.express.slice(this.pos, this.pos + 1);
//         this.pos++;
//         return ch;
//     }
// };

// printline(Binary('/')([Func('j', Unary('-')(Literal('.1')()))(Literal('.2')()), Literal('5')()]));





// var war_exp = function() {
//     return 0;
// };

// var test_exps = function() {
//     results = [
//         (war_exp("0") === 0),
//         (war_exp("1") === 1),
//         (war_exp("-1") === -1),
//         (war_exp("1-1") === 0),
//         (war_exp("0-1") === -1),
//         (war_exp("0+1") === 1),
//         (war_exp("1+1") === 1),
//         (war_exp("-1+1") === 0),
//         (war_exp("1*1") === 1),
//         (war_exp("1*0") === 0),
//         (war_exp("2*1") === 2),
//         (war_exp("1/2") === 0.5),
//         (war_exp("1/0") === NaN),
//     ]
//     return results;
// };

// document.write(test_exps());

document.write('</pre>');
