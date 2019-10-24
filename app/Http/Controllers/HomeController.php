<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Poker\Game;

class HomeController extends Controller
{
    /**
     * Create a new controller instance.
     *
     * @return void
     */
    public function __construct()
    {
        $this->middleware('auth');
    }

    /**
     * Show the application dashboard.
     *
     * @return \Illuminate\Http\Response
     */
    public function index()
    {
        $game = (new Game)->create(7)->deal();

        return view('index')->withGame($game);
    }
}
