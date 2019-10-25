<!doctype html>
<html lang="{{ app()->getLocale() }}" class="h-full bg-grey-lighter">
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
<body class="bg-white h-screen antialiased leading-none text-white">
    @inertia
</body>
</html>

