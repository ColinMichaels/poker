const mix = require('laravel-mix');
const tailwindcss = require('tailwindcss');
const path = require('path');


mix.js('resources/js/app.js', 'public/js')
    .sass('resources/sass/app.scss', 'public/css')
    .options({
        processCssUrls: false,
        postCss: [ tailwindcss('./tailwind.config.js')],
    }).webpackConfig({
    output: { chunkFilename: 'js/[name].js?id=[chunkhash]' },
    resolve: {
        alias: {
            'vue$': 'vue/dist/vue.runtime.esm.js',
            '@': path.resolve('resources/js'),
        },
    },
})
    .version()
    .sourceMaps();
