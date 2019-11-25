<?php

namespace App\Http\Controllers;

use Exception;
use Illuminate\Http\Request;
use Inertia\Inertia;

use SpotifyWebAPI\Session;
use SpotifyWebAPI\SpotifyWebAPI;

class SpotifyController extends Controller
{
   protected $session, $options;
   private $access_token, $refresh_token, $auth;


    public function __construct() {

       $this->session = new Session(
         env('MIX_SPOTIFY_CLIENT_ID'),
         env('MIX_SPOTIFY_CLIENT_SECRET'),
         env('MIX_SPOTIFY_CALLBACK_URL')
       );
       $this->options = [
            'scope' => [
                'playlist-read-private',
                'user-read-email',
                'user-read-private',
                'app-remote-control',
                'user-read-currently-playing',
                'user-read-playback-state',
                'user-modify-playback-state',
                'user-read-recently-played'
            ],
           'state' => csrf_token()
       ];
       $this->auth = $this->session->getAuthorizeUrl($this->options);
    }

    public function index() {   //spotify.index

        return Inertia::render( 'Spotify/Index', [
            'login_url' => $this->auth,
            'is_logged_in' => session('spotify_is_logged_in'),
            'user_data' => session('spotify_user_data')
            ]);
    }

    public function show(){  //spotify/callback

    }

    public function store(){

    }

    public function edit(){
       return response($this->auth);
    }

    public function callback(){
        if(session('spotify_is_logged_in') !== true){
            $this->session->requestAccessToken( request('code'));
            $this->access_token = $this->session->getAccessToken();
            $this->refresh_token = $this->session->getRefreshToken();
            $api = new SpotifyWebAPI();
            $api->setAccessToken( $this->session->getAccessToken());
            $user_data = $api->me();
            session([
                'spotify_access_token'=> $this->access_token,
                'spotify_refresh_token' => $this->refresh_token,
                'spotify_user_data' => $user_data,
                'spotify_is_logged_in' => true
            ]);
            return Inertia::render( 'Spotify/Index', [
                'is_logged_in' => session('spotify_is_logged_in'),
                'user_data' => $user_data
            ]);
        }else{
             return redirect('/spotify');
        }
    }


    public function update(){

        $api = new SpotifyWebAPI();
        $api->setAccessToken( $this->access_token);
        $user_data = $api->me();

        return Inertia::render( 'Spotify/Index', [
            'is_logged_in' => true,
            'access_token' => $this->access_token,
            'refresh_token' => $this->refresh_token,
            'user_data' => $user_data
        ]);
    }

    public function playlists(){
        $api = new SpotifyWebAPI();
        $api->setAccessToken( $this->getAccessToken());
        $user_data = session('spotify_user_data');

        return Inertia::render('Spotify/Playlists', [
            'playlists' => $api->getUserPlaylists( $user_data->id, ['limit' =>30]),
            'user_data' => session('spotify_user_data')
        ]);
    }

     public function getPlaylist(){

         $playlist_id = request('playlist_id');
         $api = new SpotifyWebAPI();
         $api->setAccessToken( $this->getAccessToken() );

         $playlist = $api->getPlaylist($playlist_id);
         $tracks =  $api->getPlaylistTracks($playlist_id);


         return Inertia::render('Spotify/Playlist', [
             'playlist' => $playlist,
             'tracks' => $tracks->items
         ]);

     }

     public function controls($event){
         $api = new SpotifyWebAPI();
         $api->setAccessToken( $this->getAccessToken() );

         $uri = request('uri', 'spotify:track:6I1HRAkeErdwrOJIfRrfIO');
         $api->play(false, [ 'uris' => [$uri]]);

     }

    public function logout(){ // spotify // logoout
        return Inertia::render( 'Spotify/Index', [
            'login_url' => $this->auth,
            'is_logged_in' => false,
            'user_data' => null
        ]);
    }

    /**
     * @return array|Request|\Illuminate\Session\SessionManager|\Illuminate\Session\Store|mixed|string
     */
    protected function getAccessToken() {
        return  ( session( 'spotify_access_token' ) )
            ? session( 'spotify_access_token' )
            : request( 'access_token' );
    }
}
