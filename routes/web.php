<?php

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
*/

use Illuminate\Http\Resources\Json\Resource;



Route::get('login')->name('login')->uses('Auth\LoginController@showLoginForm')->middleware('guest');
Route::post('login')->name('login.attempt')->uses('Auth\LoginController@login')->middleware('guest');
Route::post('logout')->name('logout')->uses('Auth\LoginController@logout');
//Auth::routes();



Route::middleware('guest')->group(function(){

});

Route::middleware('auth')->group(function() {

    Route::get( '/', 'HomeController' )->name( 'root' );
    Route::get( '/home', 'HomeController' )->name( 'home' );

    Route::resources( [
        'games'   => 'GameController',
        'decks'   => 'DeckController',
        'players' => 'PlayerController',
        'wallet'  => 'PlayerWalletController',
        'cards'   => 'CardController',
        'users'   => 'UsersController',
        'hands'   => 'HandsController',
        'howto'   => 'HowToController'
    ] );


    Route::get('howto/game/{component}', 'HowToController@howto');
});

// Images
Route::get('/img/{path}', 'ImagesController@show')->where('path', '.*');



