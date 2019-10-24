@extends('layouts.app')

@section('content')
    <div class="full mx-auto flex flex-row">
        <div class="sidebar-menu h-screen w-1/6 bg-gray-900 h-full p-4">
            <sidebar-menu></sidebar-menu>
        </div>
        <div class="main-content flex flex-wrap mx-auto w-full bg-green-800 p-4">
            @foreach($game->players as $player)
                <div class="flex border-b-4 border-white-600 py-5">
                    <div class="flex flex-wrap  w-full md:w-1/2 mb-5 ">
                        <h2 class="text-2xl text-white font-black w-full">Player #{{$loop->iteration}}</h2>
                        @foreach($player->hand as $card)
                            <card
                                image="{{$card->image}}"
                                description="{{$card->description}}">
                            </card>
                        @endforeach
                    </div>
                    @php
                        $amount = rand(5,10000);
                        $chip = new Poker\Chip($amount);
                        $chips = $chip->split();
                    @endphp
                    <div class="flex  w-1/4 sm:w-full ">
                        <h3 class="text-2xl text-white font-black mr-20 block">${{$amount}}</h3>
                        @foreach($chips as $chip)
                        {{--    <div class="min-w-1/8 max-w-1/8"
                                 style="transform:translateX(-{{$loop->iteration * 30}}px)">
                                <img class="w-full" src="{{$chip->image}}" alt="{{$chip->value}}"/>
                            </div>--}}
                            <chip
                                image="{{$chip->image}}"
                                amount="{{$chip->value}}"
                                iteration="{{$loop->iteration}}">
                            </chip>
                        @endforeach
                    </div>
                </div>
            @endforeach

        </div>

    </div>
    <visible when-hidden="#nav">
        <button
            class="bg-blue-400 hover:bg-blue-600 rounded-full w-24 h-24 text-white text-4xl fixed z-10 bottom-0 right-0">
            +
        </button>
    </visible>
    <flash-message></flash-message>
@endsection
