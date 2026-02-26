<?php

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     *
     * @return void
     */
    public function run()
    {
        $this
            ->call(AdminUserSeeder::class)
            ->call(PlayersTableSeeder::class)
            ->call(GamesTableSeeder::class);
//            ->call(MenuItemSeeder::class)
//            ->call(MenuSeeder::class);
    }
}
