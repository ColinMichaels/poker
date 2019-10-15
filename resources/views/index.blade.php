@extends('layouts.app')

@section('content')

    <div class="container mx-auto flex flex-col items-center p-8">
        <h1 class="text-2xl font-bold">Hello World</h1>
        <scroll-link id="top" href="#categories">Go To Categories</scroll-link>

        <calculator></calculator>

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
    <trigger-form></trigger-form>
    <flash-message></flash-message>
   <visible when-hidden="#top">
        <button class="bg-blue-400 hover:bg-blue-600 rounded-full w-24 h-24 text-white text-4xl fixed z-10 bottom-0 right-0">+</button>
   </visible>
@endsection
