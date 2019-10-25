<?php

/** @var \Illuminate\Database\Eloquent\Factory $factory */

use Poker\Game;
use Faker\Generator as Faker;

$factory->define(Game::class, function (Faker $faker) {
    return [
        'name' => $faker->name,
        'min_bet' => mt_rand(1,(int)100),
        'max_bet' => mt_rand(100,(int)100000),
       ' min_players' => rand(2,(int)Game::MAX_PLAYERS),
        'max_players' => rand(2,(int)Game::MAX_PLAYERS)
    ];
});
