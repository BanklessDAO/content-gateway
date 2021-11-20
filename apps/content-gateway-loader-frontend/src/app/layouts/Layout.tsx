import { Container } from "@chakra-ui/react";
import { FunctionComponent } from "react";
import Nav from "../sections/Nav";

type Props = {
    children: JSX.Element;
};

const Layout: FunctionComponent<Props> = ({ children }) => {
    return (
        <Container maxW="lg" mx="auto">
            <Nav />
            {children}
        </Container>
    );
};

export default Layout;
