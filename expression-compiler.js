var ExpressionCompiler = (function() {

    var State = function(name, type) {
        this.name = name;
        this.type = type;
        this.links = [];
        this.link = function(condition, next_state) {
            this.links.push({condition: condition,
                            next_state: next_state});
            return next_state;  // so we can chain link declarations
        };
        this.get_next = function(character) {
            for (var index = 0; index < this.links.length; index++) {
                if (this.links[index].condition.test(character)) {
                    return this.links[index].next_state;
                }
            }
            if (this.name === null) {
                throw 'invalid state machine exit';
            }
            return null;  // signal state machine exit
        };
        return this;
    };

    this.lex_machine = function() {
        var s = {
            enter: new State(null),  // invalid exit
            white: new State('whitespace', 'whitespace'),
            num: new State('literal', 'value'),
            dot: new State(null),  // invalid exit
            ndot: new State('literal', 'value'),
            dec: new State('literal', 'value'),
            name: new State('name', 'value'),
            name_suf: new State('name', 'value'),
            o_paren: new State('o_paren', 'bracket'),
            o_square: new State('o_square', 'bracket'),
            c_paren: new State('c_paren', 'bracket'),
            c_square: new State('c_square', 'bracket'),
            power: new State('power', 'operator'),
            multiply: new State('multiply', 'operator'),
            divide: new State('divide', 'operator'),
            plus: new State('plus', 'operator'),
            minus: new State('minus', 'operator'),
            less: new State('less', 'operator'),
            greater: new State('greater', 'operator')
        };
        s.enter.link(/\s/, s.white).link(/\s/, s.white);  // w h i t e s p a c e
        s.enter.link(/\d/, s.num).link(/\d/, s.num).link(/\./, s.ndot).link(/\d/, s.dec).link(/\d/, s.dec);  // 123.45
        s.enter.link(/\./, s.dot).link(/\d/, s.dec);  // .67; dec already loops on itself ^^
        s.enter.link(/[a-z]/, s.name).link(/[a-z]/, s.name).link(/['\|]/, s.name_suf);  // rad|
        s.enter.link(/\(/, s.o_paren);  // (
        s.enter.link(/\[/, s.o_square);  // [
        s.enter.link(/\)/, s.c_paren);  // )
        s.enter.link(/\]/, s.c_square);  // ]
        s.enter.link(/\^/, s.power);  // powers
        s.enter.link(/\*/, s.multiply);  // multiply
        s.enter.link(/\//, s.divide);  // divides
        s.enter.link(/\+/, s.plus);  // pluss
        s.enter.link(/\-/, s.minus);  // minus
        s.enter.link(/</, s.less);  // lesss
        s.enter.link(/>/, s.greater);  // greaters
        return s.enter;
    }();

    this.lex = function(expression) {
        var index,
            token_start,
            tokens = [],
            state,
            next_state;
        for (index = 0; index < expression.length;) {
            try {
                token_start = index;
                state = this.lex_machine.get_next(expression.slice(index, index + 1));
                do {
                    index++;
                    next_state = state.get_next(expression.slice(index, index + 1));
                    state = next_state ? next_state : state;
                } while (next_state !== null);
            } catch(e) {
                if (e !== 'invalid state machine exit') {
                    throw e;  // some other error
                }
                state = {name: 'invalid', type: 'invalid'};
                index = expression.length;  // mark it all invalid to the end
                next_state = null;
            }
            tokens.push({
                name: state.name,
                type: state.type,
                rep: expression.slice(token_start, index),
                indices: [token_start, index]
            });
        }
        return tokens;
    };

    this.mark = function(exp) {
        var tokens = typeof exp == 'string' ? this.lex(exp) : exp,
            token_index,
            tk,
            marked = "";
        for (token_index = 0; token_index < tokens.length; token_index++) {
            tk = tokens[token_index];
            marked += '<span class="expression-'+tk.name+'">'+tk.rep+'</span>';
        }
        return marked;
    };

    this.value_clean_disambiguation = function(tokens) {
        var index,
            previous,
            token,
            value;
        for (index = 0; index < tokens.length; index++) {
            token = tokens[index];
            if (token.name === 'literal') {
                value = parseFloat(token.rep);
                token.fn = (function(value) {
                    return function() { return value; };
                })(value);
            } else if (token.name === 'name') {
                token.fn = (function(name) {
                    return function(ctx) { return ctx[name]; };
                })(token.rep);
            } else if (token.type === 'whitespace') {
                tokens.splice(index, 1);  // pop it!
                index--;  // removed from list, update counter accordingly
            } else if (token.type === 'operator') {
                if (/plus|minus/.test(token.name)) {
                    previous = tokens[index - 1];
                    if (index === 0 ||
                        /binary_operator/.test(previous.type) ||
                        /^o_/.test(previous.name)) {
                        token.type = 'unary_operator';
                    } else {
                        token.type = 'binary_operator';
                    }
                } else {
                    token.type = 'binary_operator';
                }
            }
        }
        return tokens;
    };

    var bin_wrap = function(f) {  // wrap the binary functions
        return function(lo, ro) {
            return function(cx) {
                var l = lo.fn(cx), r = ro.fn(cx);
                return f.call(null, l, r);
            };
        };
    };

    var op_funcs = {
        order: [
            [/[oc]_(paren|square)/, 'bracket'],
            [/power/, 'binary_operator'],
            [/plus|minus/, 'unary_operator'],
            [/multiply|divide/, 'binary_operator'],
            [/plus|minus/, 'binary_operator'],
            [/less|greater/, 'binary_operator']
        ],
        bin: {
            power: bin_wrap(function(l, r) { return Math.pow(l, r); }),
            multiply: bin_wrap(function(l, r) { return l * r; }),
            divide: bin_wrap(function(l, r) { return l / r; }),
            plus: bin_wrap(function(l, r) { return l + r; }),
            minus: bin_wrap(function(l, r) { return l - r; }),
            less: bin_wrap(function(l, r) { return l < r; }),
            greater: bin_wrap(function(l, r) { return l > r; }),
        },
        un: {
            plus: function(o) { return function(c) { return +o.fn(c); }; },
            minus: function(o) { return function(c) { return -o.fn(c); }; },
        }
    };

    this.pull_tree = function(tokens, start, level) {
        start = start? start : 0,
        level = level? level : 0;
        var index = start,
            end = tokens.length,
            op_index = 0,
            op,
            token,
            open,
            close;

        for (op_index = 0; op_index < op_funcs.order.length; op_index++) {
            op = op_funcs.order[op_index];
            for (index = start; index < end; index++) {
                token = tokens[index];
                if (op[0].test(token.name) && token.type === op[1]) {
                    if (token.type === 'bracket') {
                        if (/^o_/.test(token.name)) {  // open
                            this.pull_tree(tokens, index + 1, level + 1);
                            end = tokens.length;  // update on return
                        } else if (/^c_/.test(token.name)) {  // close
                            end = index;
                        }
                    } else if (token.type === 'binary_operator') {
                        lhs = tokens.splice(index - 1, 1)[0];
                        index--;  // we lost a token
                        end--;   // once for left
                        rhs = tokens.splice(index + 1, 1)[0];
                        end--;  // aaaaand once for right
                        token.fn = op_funcs.bin[token.name](lhs, rhs);
                    } else if (token.type === 'unary_operator') {
                        rhs = tokens.splice(index + 1, 1)[0];
                        end--; // we lost a token
                        token.fn = op_funcs.un[token.name](rhs);
                    }
                }
            }
        }
        if (level > 0) {
            // collapse the parens
            open = tokens[start - 1];
            token = tokens.splice(start--, 1)[0];
            close = tokens.splice(start + 1, 1)[0];
            if (open === undefined ||
                token === undefined ||
                close === undefined) {
                throw "Parse error. Check the brakets?";
            }
            if (! /^c_/.test(close.name)) {
                throw "Syntax Error at " + end + " -- expected close bracket.";
            }
            if (open.name === "o_paren" && close.name === "c_paren") {
                open.fn = (function(token) {
                    return function(c) { return token.fn(c); };
                })(token);
            } else if (open.name === "o_square" && close.name === "c_square") {
                open.fn = (function(token) {
                    return function(c) { return Math.abs(token.fn(c)); };
                })(token);
            } else {
                throw "Syntax error at " + end + " -- mismatched brackets.";
            }
            return open;
        } else {
            if (tokens.length !== 1) {
                throw "Parse error -- check operators and brackets.";
            }
            return tokens;
        }
    };


    this.ExpressionInput = (function(EXC) {
        return function(con, exp) {
            con = typeof con === 'string' ? document.getElementById(con) : con;
            var colours = document.createElement("span"),
                input = document.createElement("span");
            if (exp !== undefined) {
                input.innerHTML = exp;
            }
            con.setAttribute("class", "expression-container");
            colours.setAttribute("class", "expression-colours");
            input.setAttribute("class", "expression-input");
            input.setAttribute("contenteditable", "true");
            con.appendChild(colours);
            con.appendChild(input);
            var colour = function() {
                colours.innerHTML=EXC.mark(EXC.lex(input.textContent));
            };
            input.addEventListener("input", colour, false);
            colour();
        };
    })(this);


    this.compile = function(expression) {
        var dirty_tokens = this.lex(expression);
        var clean_tokens = this.value_clean_disambiguation(dirty_tokens);
        var compiled = this.pull_tree(clean_tokens);
        return compiled[0].fn;
    };
});

var EXC = new ExpressionCompiler();
