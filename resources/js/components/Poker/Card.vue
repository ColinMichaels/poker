<template>
    <div class="card-container" :class="{flipped: flipped}" @click="flip">
        <div class="card">
            <div class="card-front">
                <img :src="card_front" :alt="description"/>
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
        data(){
          return{
              card_back : '/Poker/cards/Card_back_06.svg',
              card_front : '/Poker/cards/AS.svg',
              description: '',
              suit: 'D',
              flipped: false
          }
        },
        methods: {
            flip() {
                sound.play();
                this.flipped = !this.flipped;
            },
            setImage(){
               this.card_front = imagePath + this.name + '.svg';
            },
            setDescription(){
                 let name = this.name.match(/\d+/g);
                 let suit = this.name.match(/[A-Z]+/g);
                 this.description = NAMES[name]  + " of "+ SUITS[suit];
            }
        },
        mounted(){
          this.setImage();
          this.setDescription()
        }
    }
</script>
