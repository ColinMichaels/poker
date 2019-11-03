<template>
        <div class="games text-white">
                <div class="game-name">
                    <header class="heading">
                        <slot name="heading">
                            <slot name="title">Title</slot>
                            <slot name="description">Description</slot>
                        </slot>
                    </header>
                    <main class="rounds py-16">
                        <slot name="rounds"></slot>
                    </main>
                    <footer class="rules">
                        <slot name="rules"></slot>
                        <em class="text-sm italic mt-12 text-gray-600">The rules above are from "Robert Rules of Poker" which is authored by Robert Ciaffone, better known in the poker world as Bob Ciaffone, a leading authority on cardroom rules.</em>
                    </footer>
                </div>
        </div>
</template>

<style scoped>
    .deck{
        @apply px-20 pt-8 my-6 bg-green-900 border-8 border-black;
        border-radius: 30px;
    }
    .deck .cards{

        @apply flex py-8 relative;
    }
    .rules{
        @apply bg-gray-400 text-gray-1000 -mx-16 py-16 px-32 font-mono;
    }
    h2{
        @apply text-4xl font-black;
    }
    h3{
         @apply text-2xl font-black;
    }
    h6{
        @apply font-extrabold text-2xl;
    }
    h6.top{
        transform: translate3d(-83px, -53px, 0);
    }
    strong, p{
        @apply py-5 leading-relaxed;
    }
    strong {
        @apply font-black text-xl;
    }
    li{
        @apply py-4;
    }
</style>
