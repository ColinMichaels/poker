<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;

class HowToController extends Controller {
    public function index() {
        return Inertia::render( 'HowTo/Index' );
    }

    public function howto($game){
       return Inertia::render("HowTo/Index",[
           'game' => $game
       ] );
    }
}
