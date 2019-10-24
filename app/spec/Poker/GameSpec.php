<?php

namespace spec\Poker;

use Poker\Deck;
use Poker\Game;
use PhpSpec\ObjectBehavior;
use Prophecy\Argument;

class GameSpec extends ObjectBehavior {

    const BET_MAX = 1000;
    const BET_MIN = 1;
    const NUM_CARDS_PER = 5;
    const MAX_PLAYERS = 8;

	function it_is_initializable() {

		$this->shouldHaveType( Game::class );

	}

	function it_has_one_deck() {

		$this->deck->shouldReturnAnInstanceOf( Deck::class );
	}

	function it_should_have_2_players_if_two_players_given() {

		$this->create( 2 )->players->shouldHaveCount( 2 );

	}

	function it_should_have_3_players_if_three_players_given() {

		$this->create( 3 )->players->shouldHaveCount( 3 );

	}

	function it_takes_exception_with_invalid_num_players(){

		$this->shouldThrow('InvalidArgumentException')->duringCreate(9);
	}

	function it_should_shuffle_the_deck_when_starting_a_new_game() {

		// create a new deck instance this will be in order so we can compare against it
		$random_deck = ( new Deck )->shuffle();
		// shuffle the deck
		$this->create( 2 )->deck->shouldNotEqual( $random_deck );
		//compare decks

	}

	function it_should_deal_5_cards_to_each_players_hand() {

		$game = $this->create(2)->deal();
		$game->players[0]->hand->getCards()->shouldHaveCount(5);
	}

	function it_should_deal_5_cards_to_player2_hand() {

        $game = $this->create(2)->deal();
        $game->players[1]->hand->getCards()->shouldHaveCount(5);
	}

	function it_should_have_42_cards_remaining_after_the_deal(){

        $game = $this->create(2)->deal();
		$game->deck->cards->shouldHaveCount(42);

	}

	function it_should_take_a_bet_from_first_player(){

		  $this->create(2)->players[0]->bet(5)->shouldReturn(5);

	}

	function it_takes_exception_with_invalid_bet_amount(){

		$game = $this->create(3);
		$game->shouldThrow('InvalidArgumentException')->duringBet(0);
	}

	function it_should_match_bet_amount_for_next_player(){

		$num_players = 3;
		$bets = [5,10,10];
		$game = $this->create( $num_players);
		for($i =0; $i< $num_players; $i++){
			$player = $game->players[$i];
			$player->withdraw($bets[$i]);
			$game->bet($bets[$i]);
		}

		$game->pot->shouldEqual(array_sum($bets));

	}

	function it_should_allow_game_options_to_be_set_by_passing_an_array_of_options(){

	    $options = [
            'bet_max'       => self::BET_MAX,
            'bet_min'       => self::BET_MIN,
            'max_players'   => self::MAX_PLAYERS,
            'num_cards_per' => self::NUM_CARDS_PER
        ];

	    $this->beConstructedWith($options);

	    $this->getOptions()->shouldReturn([
            'bet_max'  => self::BET_MAX,
            'bet_min'       => self::BET_MIN,
            'max_players'   => self::MAX_PLAYERS,
            'num_cards_per' => self::NUM_CARDS_PER
        ]);
    }


}
