<?php

/** @var \Illuminate\Database\Eloquent\Factory $factory */

use App\MenuItem;
use App\Model;
use Faker\Generator as Faker;

$factory->define(MenuItem::class, function (Faker $faker) {
    return [
        'menu_id' => null,
        'name' => $faker->name,
        'title' => $faker->name,
        'link' => $faker->url,
        'target' => '_self'
    ];
});
