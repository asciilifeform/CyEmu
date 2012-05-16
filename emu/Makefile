PROGRAM = mwemu

CXX = g++

SDL_INC= `sdl-config --cflags`
SDL_LIB= `sdl-config --libs`

OBJECTS := $(patsubst %.c,%.o,$(wildcard *.c))

FLAGS = -Wall -Wextra -pedantic
INCLUDE= $(SDL_INC)
LIBS = $(SDL_LIB)


.SUFFIXES: .o .c

.c.o:
	$(CXX) $(FLAGS) $(INCLUDE) -c $< -o $@

all:    $(PROGRAM)

$(PROGRAM):     $(OBJECTS)
		$(CXX) $(LIBS) $(FLAGS) -o $(PROGRAM) $(OBJECTS)

clean :
	rm -rf nul core *flymake* *.o $(PROGRAM) *~ bin obj

check-syntax:
	$(CXX) -c $(FLAGS) $(INCLUDE) -o nul -Wall -S $(CHK_SOURCES)
