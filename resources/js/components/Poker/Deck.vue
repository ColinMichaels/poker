<template>
    <div>
        <div class="flex flex-wrap" id="deck">
            <card
                :ref="card"
                v-for="card in cards"
                v-bind:name="card"
                v-bind:key="card"
                :is_flipped="is_flipped"
                ></card>
        </div>
    </div>
</template>

<script>
    import GameComponent  from "@/plugins/game/GamePlugin";
    import {TweenMax, Power2, TimelineLite} from "gsap/TweenMax";
    import Draggable from "gsap/Draggable";
    import Card from "./Card";
    const total_cards = 52;
    export default {
        name: "Deck",
        data(){
            return{
                is_flipped : false,
                cards: {
                    0: "2C",
                    1: "3C",
                    2: "4C",
                    3: "5C",
                    4: "6C",
                    5: "7C",
                    6: "8C",
                    7: "9C",
                    8: "10C",
                    9: "11C",
                    10: "AC",
                    11: "QC",
                    12: "KC",
                    13: "2D",
                    14: "3D",
                    15: "4D",
                    16: "5D",
                    17: "6D",
                    18: "7D",
                    19: "8D",
                    20: "9D",
                    21: "10D",
                    22: "11D",
                    23: "AD",
                    24: "QD",
                    25: "KD",
                    26: "2H",
                    27: "3H",
                    28: "4H",
                    29: "5H",
                    30: "6H",
                    31: "7H",
                    32: "8H",
                    33: "9H",
                    34: "10H",
                    35: "11H",
                    36: "AH",
                    37: "QH",
                    38: "KH",
                    39: "2S",
                    40: "3S",
                    41: "4S",
                    42: "5S",
                    43: "6S",
                    44: "7S",
                    45: "8S",
                    46: "9S",
                    47: "10S",
                    48: "11S",
                    49: "AS",
                    50: "QS",
                    51: "KS"
                }
            }
        },
        components:{
            Card
        },
        methods:{
            deal(){

            },
            flip() {
                sound.play();
                this.flipped = !this.flipped;
            },
            shuffleDeck(){
               this.cards =  _.shuffle(this.cards)
            },
        },
        mounted(){
           GameComponent.events.$on('deck.shuffle', this.shuffleDeck );
            GameComponent.events.$on('deck.flip', this.flip );
        }
    }
</script>
