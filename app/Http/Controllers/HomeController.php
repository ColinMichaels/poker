<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use URL;

class HomeController extends Controller
{

    public function __invoke()
    {

       return Inertia::render('Dashboard/Index');

    }
}
