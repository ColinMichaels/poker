<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;

class HandsController extends Controller {
    public function index() {
        return Inertia::render( 'Hands/Index' );
    }
}
