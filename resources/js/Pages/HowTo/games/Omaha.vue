<template>
    <game-rules :name="name">
        <template v-slot:heading>
            <div id="ohmaha">
                <h2>Ohmaha:</h2>
                <p>Omaha is similar to hold'em in using a three-card flop on the board, a fourth board card, and then a fifth board card. Each player is dealt four hole cards (instead of two) at the start. To make a hand, a player must use precisely two hole cards with three board cards. The betting is the same as in hold'em. At the showdown, the entire four-card hand should be shown to receive the pot.</p>
            </div>
        </template>
        <template v-slot:rounds>
            <div>
                <h3>Rounds of Betting:</h3>
                <ol class="numbered">
                    <li>The dealer deals each player four cards face down (hole cards or pocket cards)</li>
                    <li>
                    <div class="deck omaha-pocket">
                        <h6>Pocket Cards</h6>
                        <div class="cards" >
                            <card name="3H"></card>
                            <card name="JS"></card>
                            <card name="8C"></card>
                            <card name="2C"></card>
                        </div>
                    </div>
                    </li>
                    <li>First betting round.</li>
                    <li>The dealer burns a card, then turns over three community cards face up (the flop)</li>
                    <li>
                    <div class="deck omaha-flop">
                        <div class="cards" >
                            <card name="3H" :is_flipped="true"></card>
                            <card name="JS" :is_flipped="true"></card>
                            <card name="8C" :is_flipped="true"></card>
                        </div>
                    </div>
                    </li>
                    <li>Second betting round.</li>

                    <li>The dealer burns another card, then turns over one more community card (the turn, fourth street)</li>
                    <li>
                    <div class="deck omaha-flop">
                            <h6>Flop</h6>
                            <div class="cards">
                                <card name="3H" :is_flipped="true"></card>
                                <card name="JS" :is_flipped="true"></card>
                                <card name="8C" :is_flipped="true"></card>
                            </div>
                        </div>

                        <div class="deck texas-holdem-street">
                            <h6>The Turn</h6>
                            <div class="cards">
                                <card name="KD" :is_flipped="true"></card>
                            </div>
                        </div>
                    </li>
                    <li>Third betting round.</li>
                    <li>The dealer burns another card, then turns over one final community card (the river, fifth street)</li>
                    <div class="deck omaha-flop">
                        <h6>Flop</h6>
                        <div class="cards" >
                            <card name="3H" :is_flipped="true"></card>
                            <card name="JS" :is_flipped="true"></card>
                            <card name="8C" :is_flipped="true"></card>
                            <span class="text-6xl font-black">+</span>
                            <card name="KD" :is_flipped="true"></card>
                            <span class="text-6xl font-black">+</span>
                            <card name="AH" :is_flipped="true"></card>
                            <h6 class="top">River</h6>
                        </div>
                    </div>
                    <li>Last betting round.</li>
                    <li>Showdown. (Every remaining player shows hand. with first bettor or last raiser showing first.)</li>
                    <li>All remaining players must use their two pocket cards and the three board cards.</li>
                </ol>
            </div>
        </template>
        <template v-slot:rules>
            <div>
                <strong>Rules of Omaha</strong>
                <ul>
                    <li>All the rules of hold'em apply to Omaha except the rule on playing the board, which is not possible in Omaha (because you must use two cards from your hand and three cards from the board).</li>
                </ul>
                <strong>Omaha High-Low</strong>

                <p>Omaha is often played high-low split, 8-or-better. The player can use any combination of two hole cards and three board cards for the high hand and another (or the same) combination of two hole cards and three board cards for the low hand.</p>

                <strong>Rules of Omaha High-Low</strong>
                <ul>
                    <li>All the rules of Omaha apply to Omaha high-low split except as below.</li>
                    <li>A qualifier of 8-or-better for low applies to all high-low split games, unless a specific posting to the contrary is displayed. If there is no qualifying hand for low, the best high hand wins the whole pot.</li>
                </ul>
            </div>
        </template>
    </game-rules>
</template>

<script>
    import GameRules from "@/Pages/HowTo/GameRules";
    import Card from '@/components/Poker/Card';
    export default {
        name: "Omaha",
        components:{
            GameRules,
            Card
        },
        data(){
            return{
                name: "Omaha"
            }
        }
    }
</script>
