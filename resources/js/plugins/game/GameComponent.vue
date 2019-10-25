<template>
    <div :id="name">
        <div v-show="is_started">
            <h3 class="text-white text-3xl font-black">{{this.name.toUpperCase()}}</h3>
            <div class="game flex">
                 <deck></deck>
            </div>
        </div>
        <div class="game-controls">

        </div>
        <div class="players-panel">
<!--              Wallet amount, Chips in Game , and Stats go here.
            list other players at the table -->
        </div>
        <div class="start flex flex-col content-center justify-center text-center" v-show="!is_started">
            <h2 class="text-2xl text-white font-black my-4 animated slideInDown">Welcome to {{name.toUpperCase()}}</h2>

            <button class="animated tada delay-3s bg-blue-700 hover:bg-blue-900 px-4 py-4 rounded text-3xl font-black text-white" @click="$modal.show('start-game')">Start Game</button>
            <div class="animated delay-3s slideInUp fadeIn mt-10">
                <i class="text-white fa fa-arrow-up fa-4x animated bounce infinite"></i>
            </div>
        </div>
    </div>

</template>

<script>
    import GameComponent  from "./GamePlugin";
    import {Howl} from 'howler';
    import Deck from "../../components/Poker/Deck";
    import Card from "../../components/Poker/Card";
    import Chip from "../../components/Poker/Chip";
    let sound = new Howl({
        src: ['/Poker/sounds/shuffle.mp3']
    });


    export default {
        name: "Game",
        props: ['name'],
        components:{
             Deck, Card
        },
        data(){
            return{
                is_started : false
            }
        },
        methods:{
               startGame(){
                    this.is_started = true;
               },
                clickedStart(){
                     sound.play();
                },
                loadPlayers(){

                }
        },
        mounted(){
              GameComponent.events.$on('start', this.startGame );
              sound.play();
        }
    }
</script>

<style scoped>

</style>
