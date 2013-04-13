var field_radius = 180;
var width = field_radius * 2,
    height = field_radius * 2;

var num_players = 2,
    player_radius = 0.04,  // 4cm
    frame_step = 1 / 60;  // s

var x = d3.scale.linear()
        .domain([-1, 1]).range([0, width]),
    y = d3.scale.linear()
        .domain([-1, 1]).range([height, 0]),
    r = d3.scale.linear()
        .domain([0, 1]).range([0, field_radius]),
    ox = d3.scale.linear()
        .domain([-1, 1]).range([-field_radius, field_radius]),
    oy = d3.scale.linear()
        .domain([-1, 1]).range([-field_radius, field_radius]);

var area = d3.select('body').append('svg')
    .attr('width', width)
    .attr('height', height);

var field = area.append('g').attr('class', 'field').selectAll('circle')
        .data(d3.range(1, 0, -0.1))
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
    sum: function(v1, v2) {
        return [v1[0] + v2[0], v1[1] + v2[1]];
    },
    sub: function(v1, v2) {
        return [v1[0] - v2[0], v1[1] - v2[1]];
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

    rk_vel = vec.scale(vec.sum(vec.sum(vel1, vel4),
                       vec.scale(vec.sum(vel2, vel3), 2)), 1 / 6.0);
    rk_accel = vec.scale(vec.sum(vec.sum(accel1, accel4),
                         vec.scale(vec.sum(accel2, accel3), 2)), 1 / 6.0);

    player.pos = vec.sum(player.pos, vec.scale(rk_vel, frame_step));
    player.vel = vec.sum(player.vel, vec.scale(rk_accel, frame_step));
    player.accel = rk_accel;
};

var p1strategy = function(dist, in_speed, tan_speed) {
    return [Math.pow(dist, 2)*10 + 0.1, -tan_speed];
}

var p2strategy = function(dist, in_speed, tan_speed) {
    return [Math.pow(dist, 2)*3 + 0.08, 0];
}

var collisions = function(players) {
    // for every pair of players
    p1 = players[0];
    p2 = players[1];

        // if collided
    diff = vec.sub(p1.pos, p2.pos);
    offset = vec.len(diff);
    if (offset < (player_radius * 2)) {
            // apply collided velocities
        console.log('BOOM')
        collision_dir = vec.scale(diff, 1.0 / vec.len(diff));
        unaffected_dir = [-collision_dir[1], collision_dir[0]];

        p1_unaffected = vec.scale(unaffected_dir,
            vec.cross(p1.vel, collision_dir));
        p2_unaffected = vec.scale(unaffected_dir,
            vec.cross(p2.vel, collision_dir));

        p1_affected = vec.scale(collision_dir,
            vec.dot(p2.vel, collision_dir));
        p2_affected = vec.scale(collision_dir,
            vec.dot(p1.vel, collision_dir));

        p1.vel = vec.sum(p1_unaffected, p1_affected);
        p2.vel = vec.sum(p2_unaffected, p2_affected);


        // p1_mom = vec.scale(p1.vel, p1.mass)
        // p2_mom = vec.scale(p2.vel, p2.mass)


    }
}

var game = {
    frame_count: 0,
    players: [
        {
            pos: [0.667, 0],
            vel: [0, 0.2],
            accel: [0, 0],
            mass: 4,  // Kg
            strategy: strategy_wrapper(p1strategy),
        },
        {
            pos: [-0.667, 0],
            vel: [0, -0.04],
            accel: [0, 0],
            mass: 4,
            strategy: strategy_wrapper(p2strategy),
        }
    ]
}
game.col
game.update = function() {
    game.players.forEach(player_next);
    collisions(game.players);
    players_groups.data(game.players)
        .attr('transform', function(d) {
            return "translate(" + [x(d.pos[0]), y(d.pos[1])] + ")"; })
        .select('line').data(game.players)
            .attr('x2', function(d) { return ox(-d.accel[0]); })
            .attr('y2', function(d) { return oy(d.accel[1]); });
},


window.setInterval(game.update, frame_step * 1000);
