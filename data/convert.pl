use strict;
use warnings;

use Path::Tiny;
use Getopt::Long  qw/ GetOptions /;

my %OPTS = (
    part  => 'noun',
    cat   => '',
    guess => 1,
    help  => 0,
);
Getopt::Long::GetOptions(
    'part=s' => \$OPTS{part},
    'cat=s'  => \$OPTS{cat},
    'guess'  => \$OPTS{guess},
    'help'   => \$OPTS{help},
);

exit main();

sub process_file {
    my ($name) = @_;
    # printf("File [%s]\n", $name);

    my $part = '';
    my $cat = '';
    if ($OPTS{guess}) {
        my $b = path($name)->basename;
        my ($p, $c) = $b =~ m/[0-9]+_([a-zA-Z]+)_([a-zA-Z]+)\.[0-9a-zA-Z]+$/;
        $part = $p if $p;
        $cat  = $c if $c;
    } else {
        $part = $OPTS{part} if $OPTS{part};
        $cat  = $OPTS{cat}  if $OPTS{cat};
    }
    $cat = "-c $cat" if $cat;

    my $count = 0;
    my %last;
    open my $fp, '<', $name or die "Could not open $name: $!";
    while( my $line = <$fp>)  {
        ++$count;
        chomp($line);
        next unless $line;

        # printf("%3d | [%s]\n", $count, $line);
        my @cols = split(' ', $line);

        if ($cols[0] eq 'N') {
            next unless @cols >= 2;

            my $word = $last{$cols[1]};
            next unless $word;

            $word =~ s/\+.*//g;
            next unless $word;

            printf("note %s %s %s\n", $part, $word, join(' ', @cols[2 .. $#cols]));
            next;
        }

        my %curr = (
            en => '',
            nl => '',
            es => '',
        );
        if ($part eq 'noun') {
            if (@cols >= 2) {
                $curr{en} = sprintf("%s:%s"   , 'en', $cols[2]);
            }
            if (@cols >= 1) {
                $curr{nl} = sprintf("%s:%s", 'nl', $cols[1]);
                $curr{nl} .= sprintf("+%s", $cols[0]) unless $cols[0] eq '?';
            }
            if (@cols >= 4) {
                $curr{es} = sprintf("%s:%s", 'es', $cols[4]);
                $curr{es} .= sprintf("+%s", $cols[3]) unless $cols[3] eq '?';
            }
        }

        if ($part eq 'adjective') {
            if (@cols >= 1) {
                $curr{en} = sprintf("%s:%s", 'en', $cols[1]);
            }
            if (@cols >= 0) {
                $curr{nl} = sprintf("%s:%s", 'nl', $cols[0]);
            }
            if (@cols >= 2) {
                $curr{es} = sprintf("%s:%s", 'es', $cols[2]);
            }
        }

        next unless $curr{en} || $curr{nl} || $curr{es};

        my $out = sprintf("add %s %s %-30.30s %-30.30s %s\n",
                          $cat, $part, $curr{en}, $curr{nl}, $curr{es});
        printf("%s\n", $out =~ s/\s*$//grs);
        %last = %curr;
    }
    close $fp;
}

sub show_help {
    print <<EOS;
Convert data from Google Sheet to dict commands
Usage: $0 [options]
    --cat <category>  category to use, empty for none (default is "$OPTS{cat}")
    --part <part>     part to use (default is "$OPTS{part}")
    --guess           guess category from file name (default is $OPTS{guess})
    --help            print this help
EOS
}

sub main {
    if ($OPTS{help}) {
        show_help();
        return 0;
    }

    foreach my $arg (@ARGV) {
        process_file($arg);
    }
    return 0;
}
