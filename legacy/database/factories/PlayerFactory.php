<?php

/** @var \Illuminate\Database\Eloquent\Factory $factory */

use Poker\Player;
use Faker\Generator as Faker;

$factory->define( Player::class, function ( Faker $faker ) {

    $min = rand( 0, 1000 );
    $max = max( $min, 10000 );

    return [
        'name'         => $faker->name,
        'user_id'      => 1,
        'wallet'       => $faker->numberBetween( 10, 50000000 ),
        'wins'         => $faker->numberBetween( $min, $max ),
        'games_played' => $faker->numberBetween( $min, $max )
    ];

} );
