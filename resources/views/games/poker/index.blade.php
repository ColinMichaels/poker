@extends('layouts.app')
@section('content')
    <div class="full mx-auto flex flex-row">
        <div class="sidebar-menu h-screen w-1/6 bg-gray-900 h-full p-4">
            <sidebar-menu></sidebar-menu>
        </div>
        <div class="main-content flex flex-wrap h-full mx-auto w-full bg-green-800 p-4">
            @foreach($game->players as $player)
                <div class="flex align-middle border-b-4 w-full border-white-600 h-full py-5">
                    <div class="flex flex-auto flex-wrap w-full md:w-1/2">
                        <h2 class="text-2xl text-white font-black w-full">Player #{{$loop->iteration}}</h2>
                        <div class="cards flex">
                            @foreach($player->hand->getCards() as $card)
                                <card name="AS" </card>
                            @endforeach
                        </div>
                    </div>
                    <div class="flex  w-1/4 sm:w-full ">
                        <h3 class="text-2xl text-white font-black mr-20 block">${{$player->wallet}}</h3>
                        @foreach($player->chips() as $chip)
                            <chip amount="{{$chip->value}}"
                                iteration="{{$loop->iteration}}">
                            </chip>
                        @endforeach
                    </div>
                </div>
            @endforeach
        </div>
    </div>
@endsection
