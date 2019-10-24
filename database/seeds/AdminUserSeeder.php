<?php

use Illuminate\Database\Seeder;

use App\User;

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
        $admin->name = 'Admin';
        $admin->email = env('MAIL_FROM_ADDRESS');
        $admin->password = bcrypt('admin');
        $admin->save();

        $demo = new User;
        $demo->name = 'Demo Player';
        $demo->email = 'demo@poker.com';
        $demo->password = bcrypt('demo');
        $demo->save();

    }
}
