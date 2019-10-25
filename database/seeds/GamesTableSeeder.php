<?php

use Illuminate\Database\Seeder;
use Poker\Game;

class GamesTableSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        factory(Game::class, 50)->create();
    }
}
