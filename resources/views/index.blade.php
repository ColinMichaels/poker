@extends('layouts.app')
@section('content')
    <div class="h-full  mx-auto flex flex-row">
         <sidebar-menu :items="['5 Card','7 Card', 'Hold`em']"></sidebar-menu>
        <div class="main-content flex flex-wrap flex-grow h-screen h-full mx-auto w-full bg-green-800 p-4">
              <div class="mx-auto flex flex-col justify-center content-center">
                      <game name="poker"></game>
              </div>
        </div>
    </div>

        {{--  TODO:: This is temp till the game vue is created. --}}
        @include('games.poker.modals.start')
@endsection
