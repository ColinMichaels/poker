<!doctype html>
<html lang="{{ app()->getLocale() }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">

    <!-- CSRF Token -->
    <meta name="csrf-token" content="{{ csrf_token() }}">

    <title>{{ config('app.name', 'Starter') }}</title>

    <!-- Styles -->
    <link href="{{ mix('css/app.css') }}" rel="stylesheet">
    <!-- Scripts -->
    <script src="{{ mix('js/app.js') }}"></script>
</head>
<body class="bg-black h-screen antialiased leading-none text-white">
    @inertia
    <div id="app" data-component="{{ $component ?? '' }}" data-props="{{ (isset($props)) ? json_encode($props) : '' }}">

    </div>
</body>
</html>

