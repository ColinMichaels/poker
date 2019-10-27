<template>
    <div class="card-container" :class="{flipped: flipped}" @click="flip">
        <div class="card">
            <div class="card-front">
                <img :src="card_image_front" :alt="description"/>
            </div>
            <div class="card-back">
                <img :src="card_back" :alt="description"/>
            </div>
        </div>
    </div>
</template>

<script>
    import {Howl} from 'howler';

    import  {SUITS} from './suits';
    import  {NAMES} from './names';

    let Card = class Card{
        constructor(suit, value){
            this.suit = suit;
            this.value = value;
        }
    };

    let sound = new Howl({
        src: ['/Poker/sounds/card.mp3']
    });

    const imagePath = '/Poker/cards/';

    export default {
        name: "PokerCard",
        props: {
            name,
            is_flipped: {
                type: Boolean,
                default: true
            }
        },
        data() {
            return {
                card_back: '/Poker/cards/Card_back_06.svg',
                card_front: '/Poker/cards/AS.svg',
                suit: 'D',
                flipped: false
            }
        },
        methods: {
            flip() {
                sound.play();
                this.flipped = !this.flipped;
            }
        },
        computed: {
            card_image_front() {
                return this.card_front = imagePath + this.name + '.svg';
            },
            description() {
                let name = this.name.match(/[A-Z | 0-9](?=[A-Z| 0-9])+/g);
                let suit = this.name.match(/[A-Z](?![A-Z])+/g);
               return  NAMES[name] + " of " + SUITS[suit];
            }
        }
    }
</script>
