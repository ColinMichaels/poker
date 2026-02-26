<?php

namespace App\Providers;

use Carbon\CarbonImmutable;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Pagination\UrlWindow;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\ServiceProvider;
use Inertia\Inertia;
use League\Glide\Server;

class AppServiceProvider extends ServiceProvider
{

    public function boot()
    {
        Date::use(CarbonImmutable::class);
        Schema::defaultStringLength(191);
    }
    public function register()
    {
        $this->registerInertia();
    }
    public function registerInertia()
    {
        Inertia::version(function () {
            return md5_file(public_path('mix-manifest.json'));
        });

        Inertia::share([
            'auth' => function () {
                return [
                    'user' => Auth::user() ? [
                        'id' => Auth::user()->id,
                        'first_name' => Auth::user()->first_name,
                        'last_name' => Auth::user()->last_name,
                        'email' => Auth::user()->email,
                        'player' => [
                            'name' => Auth::user()->player()->name,
                            'wallet' => Auth::user()->player()->wallet,
                            'wins' =>  Auth::user()->player()->wins,
                            'games_played' =>  Auth::user()->player()->games_played,
                        ],
                    ] : null,
                ];
            },
            'flash' => function () {
                return [
                    'success' => Session::get('success'),
                ];
            },
            'errors' => function () {
                return Session::get('errors')
                    ? Session::get('errors')->getBag('default')->getMessages()
                    : (object) [];
            },
        ]);
    }

    protected function registerGlide()
    {
        $this->app->bind(Server::class, function ($app) {
            return Server::create([
                'source' => Storage::getDriver(),
                'cache' => Storage::getDriver(),
                'cache_folder' => '.glide-cache',
                'base_url' => 'img',
            ]);
        });
    }

}
