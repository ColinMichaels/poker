<?php
namespace Poker;

class Card extends Game
{

	const NAMES  =['ace','two','three','four','five','six','seven','eight','nine','ten','jack','queen','king'];
	const ABBR = ['A',2,3,4,5,6,7,8,9,10,'J','Q','K'];

	public $suit, $value, $name, $abbr, $symbol;

	public function __construct($suit ='spades', $value =1) {

		$this->suit  = new Suit($suit);
		$this->value = $value;
		$this->name  = self::NAMES[ $this->value - 1 ];
		$this->abbr  = self::ABBR[ $this->value - 1 ];
		$this->symbol = $this->suit->symbol;
	}

	public function getDescriptionAttribute(){

		return ucfirst($this->name)." of ". ucfirst($this->suit->name);
	}

	public function getImagePath(){

		return asset('Poker/cards/');
	}

	public function getIdAttribute(){
	       return $this->abbr . strtoupper( substr( $this->suit->name, 0, 1 ) );
    }

	public function getImageAttribute(){

        return $this->getImagePath() . "/" . $this->id . ".svg";
	}

}
