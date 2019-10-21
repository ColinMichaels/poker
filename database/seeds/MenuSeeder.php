<?php

use App\Menu;
use App\MenuItem;
use Illuminate\Database\Seeder;

class MenuSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
       factory(Menu::class, 5)->create()->each(function($menu_item){
            $menu_item->items()->save(factory(MenuItem::class,5)->create([
                'menu_id' => $menu_item->id,
            ]));
       });

    }
}
