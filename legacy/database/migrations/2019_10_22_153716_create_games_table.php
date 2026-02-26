<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateGamesTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('games', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('name')->default('poker');
            $table->unsignedTinyInteger( 'min_bet')->default(0);
            $table->unsignedInteger( 'max_bet')->default( 1000);
            $table->unsignedTinyInteger( 'min_players')->default(2);
            $table->unsignedTinyInteger( 'max_players')->default(8);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('games');
    }
}
