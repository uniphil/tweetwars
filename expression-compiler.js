
var ExpressionCompiler = (function() {

    this.lexMachine = (function() {
        var TokenState = function(exitName) {
            this.exitName = exitName;
            this.links = [];
            this.link = function(condition, next_state) {
                this.links.push({condition: condition,
                                next_state: next_state});
                return next_state;  // so we can chain link declarations
            };
            this.getNext = function(character) {
                for (var t = 0; t < this.links.length; t++) {
                    if (this.links[t].condition.test(character)) {
                        return this.links[t].next_state;
                    }
                }
                if (this.exitName === null) {
                    throw 'invalid state machine exit';
                }
                return null;  // signal state machine exit
            };
            return this;
        };

        var sm = {
            enter: new TokenState(null),  // invalid exit
            white: new TokenState('whitespace'),
            num: new TokenState('literal'),
            dot: new TokenState(null),  // invalid exit
            ndot: new TokenState('literal'),
            dec: new TokenState('literal'),
            name: new TokenState('name'),
            name_suf: new TokenState('name'),
            o_paren: new TokenState('o_paren'),
            c_paren: new TokenState('c_paren'),
            operator: new TokenState('operator')
        };

        sm.enter.link(/\s/, sm.white).link(/\s/, sm.white);  // w h i t e s p a c e
        sm.enter.link(/\d/, sm.num).link(/\d/, sm.num)
            .link(/\./, sm.ndot).link(/\d/, sm.dec).link(/\d/, sm.dec);  // 123.45
        sm.enter.link(/\./, sm.dot).link(/\d/, sm.dec);  // .67
        sm.enter.link(/[a-z]/, sm.name).link(/[a-z]/, sm.name).link(/['\|]/, sm.name_suf);  // rad|
        sm.enter.link(/\(/, sm.o_paren);  // (
        sm.enter.link(/\)/, sm.c_paren);  // )
        sm.enter.link(/[\^\*\/\+\-<>]/, sm.operator);  // operators

        return sm.enter;
    }());

    this.lex = function(expression) {
        var idx = 0,
            token_start,
            tokens = [],
            state,
            next_state;
        var eat = function() {
            token_start = idx;
            state = this.lexMachine.getNext(expression.slice(idx, idx + 1));
            do {
                idx++;
                next_state = state.getNext(expression.slice(idx, idx + 1));
                state = next_state ? next_state : state;
            } while (next_state !== null);
        };
        while (idx < expression.length) {
            try {
                eat();
            } catch(e) {
                state = {exitName: 'invalid'};
                idx = expression.length;
                next_state = null;
            }
            tokens.push({
                name: state.exitName,
                rep: expression.slice(token_start, idx),
                indices: [token_start, idx]
            });
        }
        return tokens;
    };

    this.compile = (function() {
        var ops = {
            order: [/\^/, /[\*\/]/, /[\+\-]/, /[<>]/],
            funcs: {
                "^": function(l,r) {
                    return function(c) {return Math.pow(l.fn(c), r.fn(c)); };},
                "*": function(l,r){
                    return function(c) { return l.fn(c) * r.fn(c); }; },
                "/": function(l,r){
                    return function(c) { return l.fn(c) / r.fn(c); }; },
                "+": function(l,r){
                    return function(c) { return l.fn(c) + r.fn(c); }; },
                "-": function(l,r){
                    return function(c) { return l.fn(c) - r.fn(c); }; },
                "<": function(l,r){
                    return function(c) { return l.fn(c) < r.fn(c); }; },
                ">": function(l,r){
                    return function(c) { return l.fn(c) > r.fn(c); }; }
            }
        };

        var compiler = function(exp) {
            var tokens = typeof exp === 'string' ? this.lex(exp) : exp,
                token,
                token_index = 0;
            // strip whitespace, resolve literals and names
            while (token_index < tokens.length) {
                switch (tokens[token_index].name) {
                    case "whitespace":
                        tokens.splice(token_index, 1);  // pop it!
                        break;
                    case "literal":
                        tokens[token_index].fn = (function(value) {
                            return function() { return value; };
                        })(parseFloat(tokens[token_index].rep));
                        token_index++;
                        break;
                    case "name":
                        tokens[token_index].fn = (function(var_name) {
                            return function(cx) { return cx[var_name]; };
                        })(tokens[token_index].rep);
                        token_index++;
                        break;
                    default:
                        token_index++;
                }
            }
            // parentheses ?!?
            // operators
            for (op_index = 0; op_index < ops.order.length; op_index++) {
                token_index = 0;
                while (token_index < tokens.length) {
                    token = tokens[token_index];
                    if (tokens[token_index].name === "operator" &&
                        ops.order[op_index].test(token.rep)) {
                        group = tokens.splice(token_index-1, token_index+2);
                        group[1].fn = ops.funcs[token.rep](group[0], group[2]);
                        tokens.splice(token_index-1, 0, group[1]);
                        // token_index++;
                    } else {
                        token_index++;
                    }
                    // token_index++;
                }
            }
            return tokens[0].fn;
        };
        return compiler;
    })();

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

    return this;
})();

var EXC = ExpressionCompiler;
