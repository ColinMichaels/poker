@extends('layouts.app')

@section('content')

    <div class="full mx-auto flex flex-row">
        <div class="sidebar-menu h-screen w-1/4 bg-gray-400 h-full p-4">
            <sidebar-menu></sidebar-menu>
        </div>
        <div class="main-content flex flex-col mx-auto w-3/4 bg-red-400 p-4">
                <h1 class="text-2xl font-bold">Hello World</h1>
                <scroll-link id="top" href="#categories">Go To Categories</scroll-link>

                <calculator :items="['one','two']"></calculator>

                @include('vue-examples/modal', ['heading' => 'test', 'content' => 'yeah buddy'])
                @include('vue-examples/dropdown', ['heading' => 'test', 'content' => 'yeah buddy'])

                @include('vue-examples/confirm-dialog')

                <div id="categories">
                    <h2 class="font-bold mb-6">Testimonials</h2>
                    <div class="flex">
                        <div class="w-1/3 h-48 bg-gray-200 p-4">
                            <scroll-link href="#app">Go Back up</scroll-link>
                        </div>
                        <div class="w-1/3 h-48 bg-gray-200 p-4">Item</div>
                        <div class="w-1/3 h-48 bg-gray-200 p-4">Item</div>
                    </div>
                </div>

            </div>
{{--            <trigger-form></trigger-form>--}}

    </div>
   <visible when-hidden="#top">
        <button class="bg-blue-400 hover:bg-blue-600 rounded-full w-24 h-24 text-white text-4xl fixed z-10 bottom-0 right-0">+</button>
   </visible>
    <flash-message></flash-message>
@endsection
