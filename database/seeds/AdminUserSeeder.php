<?php

use Illuminate\Database\Seeder;

use App\User;
use Poker\Player;


class AdminUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        $admin = new User;
        $admin->first_name = 'Admin';
        $admin->email = env('MAIL_FROM_ADDRESS');
        $admin->password = bcrypt('admin');
        $admin->save();

        $demo = new User;
        $demo->first_name = 'Demo';
        $demo->last_name = 'Player';
        $demo->email = 'demo@poker.com';
        $demo->password = bcrypt('demo');
        $demo->save();

        $player = new Player;
        $player->name = "Demo Player";
        $player->user_id = $demo->id;
        $player->wallet = 10000;
        $player->wins = 0;
        $player->games_played = 0;
        $player->save();

    }
}
