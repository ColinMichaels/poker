<template>
    <div class="card-container" :class="{flipped: !flipped}" @click="flip">
        <div class="card">
            <div class="card-front">
                <img :src="image" :alt="description"/>
            </div>
            <div class="card-back">
                <img :src="card_back" :alt="description"/>
            </div>
        </div>
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
        data(){
          return{
              card_back : '/Poker/cards/Card_back_06.svg',
              flipped: false
          }
        },
        methods: {
            flip() {
                sound.play();
                this.flipped = !this.flipped;
            }
        }
    }
</script>
<style>
    .card-container{
        perspective: 1000px;
        @apply my-3 mx-1 h-full;
        position: relative;
    }
    .card-container.flipped .card{
        transform: rotateY(180deg);
    }

    .card{
        transition: transform 1s;
        transform-style: preserve-3d;
    }
    .card-front, .card-back{
        backface-visibility: hidden;
        position: absolute;
    }
    .card, .card-front, .card-back{
        @apply w-1/5 h-full;
        min-width:75px;
    }

    .card-front{
        z-index: 2;
        /* for firefox 31 */
        transform: rotateY(0deg);
    }
    .card-back{
        transform: rotateY(180deg);
    }
</style>
