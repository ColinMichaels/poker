<?php

namespace App\Http\Controllers;


use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Poker\Game;
use App\Http\Resources\Game as GameResource;
use App\Http\Resources\Games as GamesCollection;

class GameController extends Controller
{

    public function index()
    {
        return Inertia::render('Game/Index', [
            'filters' => Request::all('search', 'role', 'trashed'),
            'games' => Game::all()->toArray(),
        ]);
    }

    public function toJson()
    {
        return  new GamesCollection( Game::all());
    }

    public function create()
    {
        //
    }

    public function store(Request $request)
    {
        //
    }

    public function show($game)
    {
        return new GameResource(Game::all());
    }

    public function edit($id)
    {
        $game = Game::findOrFail($id);
        return view('games.edit')->withGame($game);
    }

    public function update(Request $request, $id)
    {
        //
    }

    public function destroy($id)
    {
       $game = Game::findOrFail($id);
       $game->delete();

    }
}
