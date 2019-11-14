<?php

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
*/

Route::get('login')->name('login')->uses('Auth\LoginController@showLoginForm')->middleware('guest');
Route::post('login')->name('login.attempt')->uses('Auth\LoginController@login')->middleware('guest');
Route::post('logout')->name('logout')->uses('Auth\LoginController@logout');
//Auth::routes();

Route::middleware('auth')->group(function() {

    Route::get( '/', 'HomeController' )->name( 'root' );
    Route::get( '/home', 'HomeController' )->name( 'home' );

    Route::get('spotify/callback', 'SpotifyController@callback');
    Route::get('spotify/playlists','SpotifyController@playlists')->name('spotify.playlists');
    Route::post('spotify/playlist', 'SpotifyController@getPlaylist');
    Route::post('spotify/controls/{event}', 'SpotifyController@controls');

    Route::resources( [
        'games'   => 'GameController',
        'decks'   => 'DeckController',
        'players' => 'PlayerController',
        'wallet'  => 'PlayerWalletController',
        'cards'   => 'CardController',
        'users'   => 'UsersController',
        'hands'   => 'HandsController',
        'howto'   => 'HowToController',
        'spotify' => 'SpotifyController'
    ] );

    Route::get('howto/game/{component}', 'HowToController@howto');
});

// Images
Route::get('/img/{path}', 'ImagesController@show')->where('path', '.*');



