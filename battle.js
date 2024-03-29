var field_r = 240;
var width = field_r * 2,
    height = field_r * 2;

var num_players = 2,
    player_radius = 0.04,  // 4cm
    frame_step = 1 / 60;  // s

var x = d3.scale.linear().domain([-1, 1]).range([0, width]),
    y = d3.scale.linear().domain([-1, 1]).range([height, 0]),
    r = d3.scale.linear().domain([0, 1]).range([0, field_r]),
    ox = d3.scale.linear().domain([-1, 1]).range([-field_r, field_r]),
    oy = d3.scale.linear().domain([-1, 1]).range([-field_r, field_r]);

var body = d3.select('body');

body.selectAll('.nojs').remove();

var controls = body.selectAll("div.control")
        .data(d3.range(num_players))
    .enter().append('div')
        .attr('class', 'control')
        .attr('id', function(d, i) {return "p" + i + "control"; });

controls.append('div')
    .attr('class', 'rdiv')
    .text('r< ').append('div')
        .each(function(d, i) {
            var key = 'p' + i + 'r< ';
            var init = localStorage[key] || "0.1";
            EXC.ExpressionInput(this, init);
        });

controls.append('div')
    .attr('class', 'rtdiv')
    .text('r^ ').append('div')
        .each(function(d, i) {
            var key = 'p' + i + 'r^ ';
            var init = localStorage[key] || "0";
            EXC.ExpressionInput(this, init);
        });

controls.append('div')
    .attr('class', 'odiv')
    .text('o< ').append('div')
        .each(function(d, i) {
            var key = 'p' + i + 'o< ';
            var init = localStorage[key] || "0";
            EXC.ExpressionInput(this, init);
        });

controls.append('div')
    .attr('class', 'otdiv')
    .text('o^ ').append('div')
        .each(function(d, i) {
            var key = 'p' + i + 'o^ ';
            var init = localStorage[key] || "0";
            EXC.ExpressionInput(this, init);
        });

var area = body.append('svg')
    .attr('width', width)
    .attr('height', height);

var field = area.append('g').attr('class', 'field').selectAll('circle')
        .data([1]) //d3.range(1, 0, -0.1))
    .enter().append('circle')
        .attr('cx', x(0))
        .attr('cy', y(0))
        .attr('r', r)
        .attr('class', 'field-ring');
        // .style('opacity', function(d, i) { return i / 10.0; });

var players_groups = area.selectAll('.player')
        .data(d3.range(num_players))
    .enter().append('g')
        .attr('class', 'player');
players_groups.append('line').attr('x1', 0).attr('y1', 0);
players_groups.append('circle').attr('r', r(player_radius));

var vec = {
    sum: function(v1, v2) { return [v1[0] + v2[0], v1[1] + v2[1]]; },
    sub: function(v1, v2) { return [v1[0] - v2[0], v1[1] - v2[1]]; },
    scale: function(v, scale) { return [v[0] * scale, v[1] * scale]; },
    dot: function(v1, v2) { return (v1[0] * v2[0]) + (v1[1] * v2[1]); },
    // ahem, not really cross...
    cross: function(v1, v2) { return (v1[0] * v2[1]) - (v2[0] * v1[1]); },
    len: function(v) {
        return Math.sqrt(Math.pow(v[0], 2) + Math.pow(v[1], 2));
    }
};

// .5 * (o>.3)
// -o| * (o<.3) * 30

var strategy_wrapper = function(strategy) {
    var compiled_strategy = [
        EXC.compile(strategy[0]),
        EXC.compile(strategy[1]),
        EXC.compile(strategy[2]),
        EXC.compile(strategy[3])
    ];
    return function(pos, vel, mass, op) {
        var rel_pos = vec.sub(op.pos, pos),
            rel_vel = vec.sub(vel, op.vel);
        var context = {
            "r": vec.len(pos),  // dist from centre
            "r'": -vec.dot(vel, pos) / vec.len(pos),  // speed toward centre
            "r|": -vec.cross(vel, pos) / vec.len(pos),  // speed tangent to centre
            "o": vec.len(rel_pos),
            "o'": vec.dot(rel_vel, rel_pos) / vec.len(pos),
            "o|": vec.cross(rel_vel, rel_pos) / vec.len(pos)
        };
        var p_force = [
            compiled_strategy[0](context),
            compiled_strategy[1](context),
            compiled_strategy[2](context),
            compiled_strategy[3](context)
        ];
        p_force[0] = Math.min(p_force[0], 1);
        p_force[1] = Math.min(p_force[1], 1);
        p_force[2] = Math.min(p_force[2], 1);
        p_force[3] = Math.min(p_force[3], 1);

        var pos_unit = vec.scale(pos, 1.0 / vec.len(pos));
        var tan_unit = [-pos_unit[1], pos_unit[0]];
        var op_unit = (function(v) {
            return vec.scale(v, 1/vec.len(v));
        })(vec.sub(op.pos, pos));
        var opt_unit = [-op_unit[1], pos_unit[0]];
        var c_force = vec.scale(pos_unit, -p_force[0]);
        var t_force = vec.scale(tan_unit, p_force[1]);
        var o_force = vec.scale(op_unit, p_force[2]);
        var ot_force = vec.scale(opt_unit, p_force[3]);
        var cforce = vec.sum(c_force, t_force);
        var oforce = vec.sum(o_force, ot_force);
        var force = vec.sum(cforce, oforce);
        var accel = vec.scale(force, 1.0 / mass);
        return accel;
    };
};

var player_next = function(player, op) {
    // runge kutta

    var pos1 = player.pos;
    var vel1 = player.vel;
    var accel1 = player.strategy(pos1, vel1, player.mass, op);

    var pos2 = vec.sum(player.pos, vec.scale(vel1, frame_step / 2));
    var vel2 = vec.sum(player.vel, vec.scale(accel1, frame_step / 2));
    var accel2 = player.strategy(pos2, vel2, player.mass, op);

    var pos3 = vec.sum(player.pos, vec.scale(vel2, frame_step / 2));
    var vel3 = vec.sum(player.vel, vec.scale(accel2, frame_step / 2));
    var accel3 = player.strategy(pos3, vel3, player.mass, op);

    var pos4 = vec.sum(player.pos, vec.scale(vel3, frame_step));
    var vel4 = vec.sum(player.vel, vec.scale(accel3, frame_step));
    var accel4 = player.strategy(pos4, vel4, player.mass, op);

    var rk_vel = vec.scale(vec.sum(vec.sum(vel1, vel4),
                           vec.scale(vec.sum(vel2, vel3), 2)), 1 / 6.0);
    var rk_accel = vec.scale(vec.sum(vec.sum(accel1, accel4),
                             vec.scale(vec.sum(accel2, accel3), 2)), 1 / 6.0);

    player.pos = vec.sum(player.pos, vec.scale(rk_vel, frame_step));
    player.vel = vec.sum(player.vel, vec.scale(rk_accel, frame_step));
    player.accel = rk_accel;
};

var collide = function(p1, p2, diff_vect) {
    var normal = vec.scale(diff_vect, 1.0 / vec.len(diff_vect));
    var tangential = [-normal[1], normal[0]];

    var p1_norm = vec.dot(p1.vel, normal);
    var p2_norm = vec.dot(p2.vel, normal);
    var p1_tang = vec.scale(tangential, vec.dot(p1.vel, tangential));
    var p2_tang = vec.scale(tangential, vec.dot(p2.vel, tangential));

    var p1_post = ((p1_norm * (p1.mass - p2.mass) + 2 * p2_norm * p2.mass) /
                   (p1.mass + p2.mass));
    var p2_post = ((p2_norm * (p2.mass - p1.mass) + 2 * p1_norm * p1.mass) /
                   (p2.mass + p1.mass));

    var p1_post_norm = vec.scale(normal, p1_post);
    var p2_post_norm = vec.scale(normal, p2_post);

    p1.vel = vec.sum(p1_post_norm, p1_tang);
    p2.vel = vec.sum(p2_post_norm, p2_tang);
};

var collisions = function(players) {
    for (p1_n = 0; p1_n < (players.length - 1); p1_n++) {
        var p1 = players[p1_n];
        for (p2_n = (p1_n + 1); p2_n < players.length; p2_n++) {
            var p2 = players[p2_n];
            var diff = vec.sub(p1.pos, p2.pos);
            var offset = vec.len(diff);
            if (offset < (p1.radius + p2.radius)) { collide(p1, p2, diff); }
        }
    }
};

var winner = false

var boundaries = function(players) {
    if (! winner) {
        for (var n in players) {
            var p = players[n];
            if (r(vec.len(p.pos)) > field_r) {
                d3.select(document.body)
                    .attr('class', 'p' + n + '-lost');
                    winner = true;
                // players.splice(n, 1);
            }
        }
    }
};


var game = {
    frame_count: 0,
    players: [
        {
            pos: [0, 0.4],
            vel: [0.03, 0],
            accel: [0, 0],
            forces: [0, 0, 0, 0],
            radius: 0.03,
            mass: 6,  // Kg
            strategy: strategy_wrapper([
                localStorage['p0r< '] || "0.1",
                localStorage['p0r^ '] || "0",
                localStorage['p0o< '] || "0",
                localStorage['p0o^ '] || "0",
            ])
        },
        {
            pos: [0, -0.4],
            vel: [-0.03, 0],
            accel: [0, 0],
            forces: [0, 0, 0, 0],
            radius: 0.03,
            mass: 6,  // Kg
            strategy: strategy_wrapper([
                localStorage['p1r< '] || "0.1",
                localStorage['p1r^ '] || "0",
                localStorage['p1o< '] || "0",
                localStorage['p1o^ '] || "0",
            ])
        }
    ]
};

controls.data(game.players)
    .on('input', function(d, i) {
        var me = d3.select(this);
        var ri = me.select('.rdiv .expression-input')[0][0].textContent,
            rt = me.select('.rtdiv .expression-input')[0][0].textContent,
            oi = me.select('.odiv .expression-input')[0][0].textContent,
            ot = me.select('.otdiv .expression-input')[0][0].textContent;
        d.strategy = strategy_wrapper([ri, rt, oi, ot]);
        localStorage['p' + i + 'r< '] = ri;
        localStorage['p' + i + 'r^ '] = rt;
        localStorage['p' + i + 'o< '] = oi;
        localStorage['p' + i + 'o^ '] = ot;
    });

game.update = function() {
    for (var p=0; p<game.players.length; p++) {
        player_next(game.players[p], game.players[(p + 1) % game.players.length]);
    }
    // game.players.forEach(player_next);
    collisions(game.players);
    boundaries(game.players);
    groups = players_groups.data(game.players);
    groups.exit().remove();
    groups.attr('transform', function(d) {
            return "translate(" + [x(d.pos[0]), y(d.pos[1])] + ")"; })
        .select('line')
            .attr('x2', function(d) { return ox(-vec.scale(d.accel, d.mass)[0]); })
            .attr('y2', function(d) { return oy(vec.scale(d.accel, d.mass)[1]); });
    groups.select('circle')
        .attr('r', function(d) { return r(d.radius); });
};

game.toggle = function() {
    if (window.the_game_is_running) {
        window.clearInterval(window.the_game_is_running);
        window.the_game_is_running = 0;
    } else {
        window.the_game_is_running = window.setInterval(
            game.update, frame_step * 1000);
    }
};

game.reset = function() {
    winner = false;
    d3.select(document.body)
        .attr('class', '');
    game.players[0].pos = [0, 0.4];
    game.players[0].vel = [0.03, 0];
    game.players[1].pos = [0, -0.4];
    game.players[1].vel = [-0.03, 0];
    game.update();
}; game.reset();

d3.select(document.body).selectAll("button.state-button")
        .data([
            {label: "reset", action: game.reset},
            {label: "play/pause", action: game.toggle}
        ]).enter()
    .append("button").attr("class", "state-button")
    .text(function(d) { return d.label; })
    .on("click", function(d) { d.action(); });
