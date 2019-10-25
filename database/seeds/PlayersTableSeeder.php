<?php

use App\User;
use Illuminate\Database\Seeder;
use Poker\Player;

class PlayersTableSeeder extends Seeder {
    /**
     * Run the database seeds.
     * @return void
     */
    public function run() {
        factory( Player::class, 100 )->create()->each( function ( $player ) {
            $user = factory( User::class )->create();
            $min = rand( 0, 1000 );
            $max = rand( $min, 10000 );
            $games_played = rand($max,100000);
            $player->update( [
                    'name' => Str::random(12),
                    'user_id' => $user->id,
                    'wallet'       => rand(0,100000),
                    'wins'         => $max,
                    'games_played' => $games_played

                ]
            );
        } );
    }
}
