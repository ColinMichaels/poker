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

Route::get( '/', 'HomeController' )->middleware( 'auth' );

Route::get('login')->name('login')->uses('Auth\LoginController@showLoginForm')->middleware('guest');
Route::post('login')->name('login.attempt')->uses('Auth\LoginController@login')->middleware('guest');
Route::post('logout')->name('logout')->uses('Auth\LoginController@logout');
//Auth::routes();

Route::get( '/home', 'HomeController' )->name( 'home' );

// Users
Route::middleware('auth')->group(function() {
    Route::get( 'users' )->name( 'users' )->uses( 'UsersController@index' );
    Route::get( 'users/create' )->name( 'users.create' )->uses( 'UsersController@create' );
    Route::post( 'users' )->name( 'users.store' )->uses( 'UsersController@store' );
    Route::get( 'users/{user}/edit' )->name( 'users.edit' )->uses( 'UsersController@edit' );
    Route::put( 'users/{user}' )->name( 'users.update' )->uses( 'UsersController@update' );
    Route::delete( 'users/{user}' )->name( 'users.destroy' )->uses( 'UsersController@destroy' );
    Route::put( 'users/{user}/restore' )->name( 'users.restore' )->uses( 'UsersController@restore' );

    Route::resources( [
        'games'   => 'GameController',
        'decks'   => 'DeckController',
        'players' => 'PlayerController',
        'cards'   => 'CardController',
        'users'   => 'UsersController'
    ] );
});

// Images
Route::get('/img/{path}', 'ImagesController@show')->where('path', '.*');



