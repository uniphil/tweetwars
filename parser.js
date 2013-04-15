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
start.add_transition(new Transition(/[ro]/, short_name));
short_name.add_transition(new Transition(/['\|]/, long_name));
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


// BUG! .1 tokenizes to 1
// BUG! whitespace at the end

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

var compile_expression = function(strategy) {
    // in-line replace tokens with a tree of callables
    tokens = feed_the_machine(strategy);
    // start with literals and names
    for (var t = 0; t < tokens.length; t++) {
        if (tokens[t][0] === "literal") {
            value = parseFloat(tokens[t][1]);
            tokens[t] = (function(value) {
                return function(context) { return value; };
            })(value);
        } else if (tokens[t][0] === "name") {
            name = tokens[t][1]
            tokens[t] = (function(name) {
                return function(context) { return context.get(name); };
            })(name);
        }
    }
    // parens
    // operators
    var exiter = 0;
    for (var o = 0; o < op_order.length; o++) {
        for (var t = 0; t < tokens.length;) {
            if (exiter++ > 100) throw "exit!";
            if (tokens[t][0] === "operator") {
                if (op_order[o].test(tokens[t][1])) {
                    group = tokens.splice(t-1, t+2);
                    callable = op_fns.get(group[1][1])(group[0], group[2]); // l, r
                    tokens.splice(t-1, 0, callable);
                } else {
                    t++;
                }
            } else {
                t++;
            }
        }
    }
    return tokens[0];
}



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
