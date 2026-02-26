<?php

namespace App\Http\Controllers;


use Illuminate\Support\Facades\Auth;
use Poker\Player;
use App\Http\Resources\Player as PlayerResource;
use App\Http\Resources\Players as PLayersCollection;
use Illuminate\Http\Request;


class PlayerController extends Controller
{

    public function index()
    {
        return new PlayersCollection(Player::all());
    }

    public function create()
    {
        //
    }

    public function store(Request $request)
    {
        if(request()->validated()){
           // store
        }else{
            return back()->withErrors('error');
        }
    }

    public function show($player)
    {
        return new PlayerResource(Player::findOrFail($player));
    }

    public function edit(Player $player)
    {

    }

    public function update(Request $request, Player $player)
    {
        //
    }

    public function destroy(Player $player)
    {
        //
    }
}
