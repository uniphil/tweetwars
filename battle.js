var field_radius = 180;
var width = field_radius * 2,
    height = field_radius * 2;

var num_players = 1,
    player_radius = 0.04,  // 4cm
    frame_step = 1 / 60;  // s

var x = d3.scale.linear()
        .domain([-1, 1])
        .range([0, width]),
    y = d3.scale.linear()
        .domain([-1, 1])
        .range([height, 0]),
    r = d3.scale.linear()
        .domain([0, 1])
        .range([0, field_radius]);

var area = d3.select('body').append('svg')
    .attr('width', width)
    .attr('height', height);

var field = area.selectAll('.field-ring')
        .data(d3.range(1, 0, -0.1))
    .enter().append('circle')
        .attr('cx', x(0))
        .attr('cy', y(0))
        .attr('r', r)
        .attr('class', 'field-ring');

var players_circles = area.selectAll('.player')
        .data(d3.range(num_players))
    .enter().append('circle')
        .attr('r', r(player_radius))
        .attr('class', 'player');


var vec = {
    sum: function(v1, v2) {
        return [v1[0] + v2[0], v1[1] + v2[1]];
    },
    scale: function(v, scale) {
        return [v[0] * scale, v[1] * scale];
    },
    dot: function(v1, v2) {
        return (v1[0] * v2[0]) + (v1[1] * v2[1]);
    },
    cross: function(v1, v2) {
        return (v1[0] * v2[1]) - (v2[0] * v1[1])
    },
    len: function(v) {
        return Math.sqrt(Math.pow(v[0], 2) + Math.pow(v[1], 2));
    },
    // ang: function(v) {
    //     return 0;
    // },
};

var strategy_wrapper = function(strategy) {
    var wrapped = function(pos, vel, mass) {
        dist = vec.len(pos);
        in_speed = -vec.dot(vel, pos);
        tan_speed = -vec.cross(vel, pos);

        p_force = strategy(dist, in_speed, tan_speed);

        pos_norm = vec.scale(pos, 1.0 / vec.len(pos));
        tan_norm = [-pos_norm[1], pos_norm[0]];
        c_force = vec.scale(pos_norm, -p_force[0]);
        t_force = vec.scale(tan_norm, p_force[1]);
        force = vec.sum(c_force, t_force);
        accel = vec.scale(force, 1.0 / mass)
        return accel;
    };
    return wrapped;
};

var player_next = function(player) {
    // runge kutta

    pos1 = player.pos;
    vel1 = player.vel;
    accel1 = player.strategy(pos1, vel1, player.mass);

    pos2 = vec.sum(player.pos, vec.scale(vel1, frame_step / 2));
    vel2 = vec.sum(player.vel, vec.scale(accel1, frame_step / 2));
    accel2 = player.strategy(pos2, vel2, player.mass);

    pos3 = vec.sum(player.pos, vec.scale(vel2, frame_step / 2));
    vel3 = vec.sum(player.vel, vec.scale(accel2, frame_step / 2));
    accel3 = player.strategy(pos3, vel3, player.mass);

    pos4 = vec.sum(player.pos, vec.scale(vel3, frame_step));
    vel4 = vec.sum(player.vel, vec.scale(accel3, frame_step));
    accel4 = player.strategy(pos4, vel4, player.mass);

    pos_final = vec.sum(player.pos,
        vec.scale(vec.sum(vec.sum(vel1, vel4),
                          vec.scale(vec.sum(vel2, vel3), 2)),
                 frame_step / 6.0))
    vel_final = vec.sum(player.vel,
        vec.scale(vec.sum(vec.sum(accel1, accel4),
                          vec.scale(vec.sum(accel2, accel3), 2)),
                 frame_step / 6.0))

    player.pos = pos_final;
    player.vel = vel_final;
};

var p1strategy = function(dist, in_speed, tan_speed) {
    return [0.2, 0];
}

var game = {
    frame_count: 0,
    players: [
        {
            pos: [0.667, 0],
            vel: [0, 0.1],
            mass: 4,  // Kg
            strategy: strategy_wrapper(p1strategy),
        },
    ],
}
game.update = function() {
    game.players.forEach(player_next);
    players_circles.data(game.players)
        .attr('cx', function(d) { return x(d.pos[0]); })
        .attr('cy', function(d) { return y(d.pos[1]); });
},


window.setInterval(game.update, frame_step * 1000);
