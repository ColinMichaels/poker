<template>
    <div class="w-1/3 md:w-1/5" @click="flip">
        <img :src="image" :alt="description" class="w-full p-2 my-1"/>
    </div>
</template>

<script>
    import {Howl} from 'howler';

    let sound = new Howl({
        src: ['/Poker/sounds/card.mp3']
    });
    export default {
        name: "PokerCard",
        props: ['image', 'description'],
        methods: {
            flip() {
                sound.play();
            }
        }
    }
</script>
