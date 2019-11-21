<template>
    <div>
        <transition-group name="shuffleDeck" tag="div" class="flex flex-wrap" id="deck" :class="{is_flipped: !is_flipped}" ref="deck" >
                <card
                    :ref="card.name"
                    v-for="card in cards"
                    :name="card.name"
                    :key="card.name"
                    :is_flipped="is_flipped"
                    v-on:card-clicked="flip"
                ></card>
        </transition-group>
    </div>
</template>

<script>
    import Game from "@/plugins/game/GamePlugin";
    import {gsap, CSSPlugin, TweenMax} from "gsap/all";
    gsap.registerPlugin(CSSPlugin);
    import Draggable from "gsap/Draggable";
    import Card from "./Card";

    const initData = ()=>({
        is_flipped: false,
        cards: Game.store().cards.slice(0,5),
        play_hand : [],
        position: Math.floor(Math.random() * (52 - 1 ) +1),
        selected: null
    });

    export default {
        name: "Deck",
        data() {
            return {
                is_flipped: false,
                cards: initData().cards,
                play_hand : [],
                position: Math.floor(Math.random() * (52 - 1 ) +1),
                selected: null
            }
        },
        components: {
            Card
        },
        methods: {
            remove(card){
                Game.sound('/Poker/sounds/card.mp3');
                //_.slice(this.cards, _.findIndex(this.cards,  card.name ));
            },
            deal(num_per) {
                this.resetDeck();
                this.is_flipped= false;
            },
            draw(card) {
               let deck_card = this.cards[this.position];
                Game.broadcast('card.start', deck_card.name);
               if(deck_card.name === card){
                   Game.broadcast('game.end');
                   Game.sound('/Poker/sounds/tada.mp3');
                   if(confirm(  'you found the card it was the '+ deck_card.description + '\n would you like to play again?'))
                        this.resetDeck();

               }
            },
            resetDeck(){
                Object.assign(this.$data , initData());

            },
            flip(card) {
                card.flipped = !card.flipped;
                Game.sound('/Poker/sounds/card.mp3');
            },
            flipAll(dir){
                this.is_flipped = !this.is_flipped;
                this.cards.forEach((card)=>{
                     let cur_card = this.$refs[card.name][0];
                     if(cur_card !== undefined){
                         cur_card.flipped = this.is_flipped;
                     }
                });
                Game.sound('/Poker/sounds/card.mp3');

            },
            shuffle() {
                this.cards =   _.shuffle(this.cards);
                Game.sound('/Poker/sounds/shuffle.mp3');
            },
            updateCard(card){
                this.draw(card);
            }
        },
        mounted() {
            Game.listen('deck.shuffle', this.shuffle);
            Game.listen('deck.deal', this.deal);
            Game.listen('deck.flip', this.flipAll);
            Game.listen('deck.reset', this.resetDeck);
        }, updated(){

        }
    }
</script>
