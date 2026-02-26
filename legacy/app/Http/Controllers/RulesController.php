<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;

class RulesController extends Controller
{
    public function index(){
        return Inertia::render('Rules/Index');
    }
}
